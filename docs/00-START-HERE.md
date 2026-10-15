# Start here: Hearth interview prep

Hearth is a mini real-estate platform built so every technology in the Compass job post appears in real, running code.
Read this page first, then the technology docs in order. Every doc has: **core concepts, advanced concepts, a walkthrough of the code in this repo, and interview Q&A**.

## The architecture (draw this on a whiteboard)

```
React (Vite, React Router) ──> HAProxy :8080 ──round-robin──> Koa BFF x2 (REST, auth, validation)
                                    │                              │ gRPC (2s deadline, round_robin)  ──> listing-svc (Go) ──pgx──> Postgres
                                    │ /inspections                 │ REST (3s timeout)                ──> inspection-svc (Java, JDBC) ──> Postgres (tours, UNIQUE)
                                    │                              │ Temporal client                  ──> Temporal ──> offer-worker (Go workflow + saga)
                                    └──────────────────────────────┘ pg                               ──> Postgres (users, favorites, searches, offers…)
 pricing-svc (Go, Thrift) · agent (Python LLM tool loop) · Airflow DAG ──> analytics.city_stats
 Infra: Docker/Compose, Kubernetes (kustomize), Terraform (S3, SQS+DLQ, IAM, RDS module), CircleCI, Datadog config
```

The full product description, API reference, data model and run instructions are in the repository [README](../README.md).

## What was actually run and verified (be honest about this in the interview)

| Piece | Verified how |
|---|---|
| Go listing service (gRPC + Postgres) | 14 tests: SQL-builder unit tests (injection, paging) + **integration tests against real Postgres** (filters, full-text, sort, detail, similar, market, streaming, gRPC codes) |
| Go pricing service (Thrift) | real client/server over TCP incl. the typed exception |
| Temporal offer workflow | unit tests (approve, 72h timeout, saga compensation, **status query**) and a real run on a Temporal server |
| Koa BFF | 30 tests with in-memory fakes (validation, auth cookies, favorites, saved searches, tours 409, offers + rollback + signal, rate limit, error mapping) **and** live calls through HAProxy against Postgres |
| Java inspection service | contract tests on memory **and Postgres**, 20-thread race (one winner); live 201 then 409 |
| React app | `vite build`; **27 Cypress tests pass** (23 with stubbed network + 4 against the real stack incl. a full register → tour 409 → offer → Temporal `closed` journey); visual review via screenshots in light/dark/mobile; function-length rule |
| Python agent | 4 unit tests with a scripted LLM; the real Claude adapter was **not** run (no key) |
| Terraform | `apply` to LocalStack earlier (6 resources, idempotent plan, destroy); RDS module **validated, not applied** (costs money) |
| Kubernetes | earlier version ran on a `kind` cluster; the updated manifests were **rendered with kustomize only** this round |
| Airflow | DAG parsed by real Airflow 3.0.6; logic unit-tested; not scheduled on a live cluster |
| Datadog, Databricks, Redshift, Opsgenie | theory / config only |

Rule enforced: every function ≤ 10 lines (`scripts/check_function_length.py`).

## Real problems hit while building (great interview stories)

1. **Thrift version mismatch**: the generator in the Docker image and the Go library must be the same version. Fixed by pinning compiler 0.12.0 + library v0.12.0.
2. **Kubernetes `CreateContainerConfigError`**: `runAsNonRoot: true` cannot verify a *named* Docker user. Fix: numeric `USER 10001`.
3. **gRPC behind a headless Service**: default `pick_first` sends everything to one pod. Fix: `round_robin` service config. Proven by request counts per pod.
4. **HAProxy refuses to start if a backend hostname doesn't resolve**: fixed with a `resolvers` section + `init-addr libc,none`.
5. **Temporal Go SDK ignores `TEMPORAL_ADDRESS`**: the worker crashed in Docker; fixed by reading the env var in `offer.Dial()`.
6. **Thrift `Stop()` hung in tests**: it waits for open client connections; close the client first.
7. **Cypress wouldn't start**: VS Code sets `ELECTRON_RUN_AS_NODE=1`, which makes Electron behave as plain Node.
8. **Homebrew unsupported on macOS 13**: used official binaries into a space-free folder (home dir name contained a space).

## Reading order (about 6 to 8 hours if you read everything; the starred ones if short on time)

1. `01-go.md` ★  2. `02-grpc-protobuf.md` ★  3. `03-thrift.md`  4. `04-node-koa-rest.md` ★
5. `05-react-cypress.md` ★  6. `06-python-agentic-ai.md` ★  7. `07-java.md`  8. `08-temporal.md` ★
9. `09-postgres-redshift.md`  10. `10-airflow-databricks.md`  11. `11-docker-haproxy.md` ★
12. `12-kubernetes.md` ★  13. `13-terraform-aws.md` ★  14. `14-circleci-github.md`
15. `15-datadog-opsgenie.md`  16. `16-system-design-and-behavioral.md` ★

## How to run it

```bash
source scripts/env.sh                      # puts Go, Docker CLI, etc. on PATH (from repo root's parent)
colima start --vm-type vz --cpu 3 --memory 6 --disk 40
docker compose up -d --build               # whole stack
curl 'localhost:8080/api/listings?city=Boston'
(cd web && npx vite --port 5173)           # UI at http://localhost:5173 (proxies to HAProxy :8080)
go test ./services/...                     # Go tests
(cd services/api && npm test)              # Node tests
```
