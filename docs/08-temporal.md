# Temporal

## Why it exists
Real business processes (offer → inspection → financing → close) take **days**, involve **many services**, and must survive **crashes, deploys, and failures**. Hand-rolling this with queues, cron jobs and status columns gets messy. **Temporal = durable execution**: you write the process as ordinary code; Temporal persists every step so it can resume exactly where it left off.

## Core concepts
- **Workflow:** your orchestration code (durable, long-running, can wait for days). **Must be deterministic.**
- **Activity:** a unit of side-effecting work (HTTP call, DB write, email). Can be non-deterministic and fail; Temporal **retries** it per policy.
- **Worker:** *your* process that polls a **task queue** and executes workflow and activity code. Temporal Server never runs your code.
- **Temporal Server/Cluster:** Frontend, History, Matching, Worker services + a database (Cassandra/Postgres/MySQL). It stores each workflow's **event history** (an append-only log).
- **Task queue:** named queue workers poll (`offers`). Route work to specific worker pools.
- **Signal:** async message *into* a running workflow (financing approved). **Query:** read-only inspect of state. **Update:** sync, validated, can return a value.
- **Timers:** `workflow.NewTimer` / `Sleep`: durable, cost nothing while waiting; survive restarts. 72 hours or 72 days is fine.
- **Workflow ID:** business key (`offer-O-1`). Starting the same ID twice is rejected/deduped by the **ID reuse/conflict policy** → natural idempotency.

## Determinism & replay (the #1 interview topic)
When a worker restarts (or a workflow is moved to another worker), Temporal **replays the workflow function from the start using the recorded event history**. Past commands (activity calls, timers) are matched to history and **not re-executed**; their recorded results are returned instantly. Therefore workflow code must produce the same commands in the same order every time:
- ❌ No `time.Now()`, `rand`, `uuid`, raw goroutines, maps iteration order, network/file/DB calls, mutable globals.
- ✅ Use `workflow.Now`, `workflow.SideEffect`/`GetVersion`, `workflow.Go`, `workflow.Sleep/NewTimer`, selectors/channels from the SDK, and do anything non-deterministic in an **Activity**.
- **Versioning:** changing workflow code that has running executions can break replay (non-determinism error). Use `workflow.GetVersion` (patching) or worker versioning, and keep old code paths until old executions finish. Test with **replay tests** against saved histories.

## Retries and timeouts
Activity timeouts: **ScheduleToStart** (wait in queue), **StartToClose** (single attempt; *always set this*), **ScheduleToClose** (overall incl. retries), **Heartbeat** (liveness for long activities). Default retry policy: exponential backoff, unlimited attempts; set `MaximumAttempts`, `NonRetryableErrorTypes`. Workflows have run/execution timeouts (usually leave unset for long-lived ones).

## Patterns
- **Saga (compensation):** if step N fails, run undo activities for steps 1..N-1 (release the hold). Use a **disconnected context** so compensation runs even if the workflow was cancelled.
- **Continue-As-New:** when history grows large (~10k+ events / 50 MB limit), restart the workflow with carried state to keep history short.
- **Child workflows**, **fan-out/fan-in**, **long polling via signals**, **entity workflows** (one workflow per entity, e.g. per listing), **schedules** (cron replacement), **Nexus** (cross-team).
- **Idempotent activities:** retries mean an activity can run more than once. Use idempotency keys (offer ID) so "hold listing" twice is harmless.

## Code walkthrough ([services/offer](../services/offer))
**[workflow.go](../services/offer/workflow.go)**
- `OfferWorkflow`: set activity options → `HoldListing` → `runSteps` → on error call `compensate`. Reads like a normal function; durability is invisible.
- `withOptions`: `StartToCloseTimeout: 30s`, `MaximumAttempts: 5`.
- `runSteps`: `ScheduleInspection` → `waitForFinancing` → if not approved return `EXPIRED` else `CloseDeal`.
- `waitForFinancing`: **Selector** waits for *either* the `financing-approved` signal *or* the 72 h timer. Whichever fires first wins. This is the "wait for human/external event with timeout" pattern.
- `compensate`: `NewDisconnectedContext` then `ReleaseListing` (saga undo).
- `var acts *Activities` is just a typed nil used to reference activity methods by name (`acts.HoldListing`).

**[activities.go](../services/offer/activities.go)**: a struct with 4 methods (stubs that log). In production these call the listing gRPC service, DB, email, etc.

**[types.go](../services/offer/types.go)**: constants for task queue, signal name, timeout; `Input` struct (must be JSON/proto-serializable).

**[cmd/worker/main.go](../services/offer/cmd/worker/main.go)**: connects (`offer.Dial()` honors `TEMPORAL_ADDRESS`), creates a worker on task queue `offers`, **registers** the workflow + activities struct, runs until interrupted.
**[cmd/starter/main.go](../services/offer/cmd/starter/main.go)**: starts a workflow with ID `offer-O-1` (**idempotent start**).

### Tests ([workflow_test.go](../services/offer/workflow_test.go)), 3 passing
1. **Approved:** delayed callback sends the signal after 1 hour of *virtual* time → result `CLOSED`.
2. **Timeout:** no signal → the 72 h timer fires **instantly** (test env skips time) → `EXPIRED`.
3. **Compensation:** `ScheduleInspection` mocked to fail → after 5 retries the workflow fails and `ReleaseListing` **was called** (`AssertExpectations`).

### Real run (verified on a live Temporal server in Docker)
Started `offer-O-1` → worker logged `hold listing`, `inspection scheduled`, `NewTimer 72h` → `temporal workflow signal -w offer-O-1 --name financing-approved` → `deal closed` → `Status COMPLETED, Result "CLOSED"`. Bug found: the Go SDK **ignores `TEMPORAL_ADDRESS`** so the worker crashed in Docker; fixed in `dial.go`.

Run it:
```bash
docker compose up -d temporal offer-worker      # UI at http://localhost:8233
go run ./services/offer/cmd/starter
temporal workflow signal -w offer-O-1 --name financing-approved
```

## Interview Q&A
**Q: Why not just use a queue + cron + DB state machine?** You'd rebuild retries, timers, state persistence, visibility, versioning and idempotency. Temporal gives them with plain code and full history for debugging.

**Q: What happens if the worker crashes mid-workflow?** Another worker (or the restarted one) picks up the workflow task, **replays** the code against history to rebuild state, and continues. Completed activities aren't re-run.

**Q: Why must workflows be deterministic?** Replay must produce the identical command sequence as the original run; otherwise Temporal raises a non-determinism error.

**Q: Workflow vs Activity?** Workflow = deterministic orchestration; Activity = side effects and I/O with retries/timeouts. Never call external systems in workflow code.

**Q: How do you handle a code change for running workflows?** `GetVersion`/patching or worker versioning; replay tests; keep old branches until old runs finish; otherwise use new workflow type + new task queue.

**Q: Exactly-once?** Workflow state transitions are effectively exactly-once; activities are **at-least-once** → make them idempotent.

**Q: How do you wait for a human approval?** Signal + selector with a timer (what we did); or `Update`. No polling, no cost while waiting.

**Q: History too large?** Continue-As-New; keep payloads small (store blobs elsewhere, pass references); child workflows for fan-out.

**Q: Temporal vs Airflow?** Temporal = event-driven business processes and microservice orchestration with per-entity workflows. Airflow = scheduled batch/data pipelines (DAGs on a cron).

**Q: Temporal vs Step Functions / SQS?** Step Functions: JSON state machines in AWS, vendor lock-in, limits. Temporal: code-first, any infra, richer testing. SQS: just a queue, no orchestration.
