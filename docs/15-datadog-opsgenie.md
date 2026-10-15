# Datadog and Opsgenie (observability and incident response)

> Neither was run for real: Datadog needs an API key (14-day trial) and Opsgenie is a paid Atlassian product. I wrote the config and the instrumentation plan; everything below is concepts you should be able to explain.

## Observability fundamentals
- **Monitoring** = known questions (is CPU high?). **Observability** = being able to ask *new* questions of a running system from its outputs: **metrics, logs, traces** (three pillars) plus **events/profiles**.
- **Metrics:** numeric time series. Types: **counter** (only up: requests), **gauge** (up/down: queue depth), **histogram/distribution** (latency percentiles). Always use **tags** (`service`, `env`, `version`, `region`) for slicing, but beware **high cardinality** tags (user_id, request_id) which explode cost and slow queries.
- **Logs:** structured JSON with a **correlation/trace id** (our `x-request-id`), levels, no PII/secrets.
- **Traces:** a request's journey across services = tree of **spans** (name, start, duration, tags, parent). Context is propagated via headers (W3C `traceparent`, Datadog `x-datadog-trace-id`). Shows where the latency/error is.
- **Golden signals (SRE):** **latency, traffic, errors, saturation**. **RED** (Rate, Errors, Duration) for services; **USE** (Utilization, Saturation, Errors) for resources.
- **SLI/SLO/SLA/error budget:** SLI = measurement (% requests < 300 ms and non-5xx); SLO = target (99.9% over 30 days); SLA = contract with penalties; **error budget** = allowed failure (0.1% ≈ 43 min/month); when exhausted, freeze features and focus on reliability. Alert on **burn rate**, not single blips.
- **Alerting quality:** alert on symptoms users feel (error rate, latency SLO burn), not every cause (CPU 80%). Every alert needs an owner, a runbook, and a clear action. Reduce noise (alert fatigue is a reliability risk). Page for urgent, ticket for non-urgent.

## Datadog
- **Agent** (a DaemonSet on Kubernetes / container in Compose) collects host/container metrics, logs, and receives **APM traces** (port 8126) and **DogStatsD** custom metrics (UDP 8125). Integrations auto-collect for Postgres, Redis, HAProxy, Kubernetes, etc.
- **APM:** auto-instrumentation libraries (`dd-trace` for Node, `dd-trace-go`, `ddtrace` for Python, Java agent `-javaagent:dd-java-agent.jar`) create spans for HTTP/gRPC/DB calls. **Unified Service Tagging:** `DD_SERVICE`, `DD_ENV`, `DD_VERSION` tie metrics, traces and logs together; deployment tracking shows regressions per version.
- **Logs:** collect from container stdout, parse with **pipelines**, index vs archive (cost), **log-trace correlation** by injecting trace ids.
- **Monitors:** metric, anomaly, outlier, composite, log, APM, synthetic, SLO monitors. **Dashboards** (timeboards/screenboards), **Notebooks** (incident analysis), **Synthetics** (scripted API/browser checks from outside: like a Cypress test in prod), **RUM** (real user monitoring for the React app), **Profiler**, **Database Monitoring**, **Network Performance**, **LLM Observability** (traces of agent steps/tokens/cost: relevant to our agent), **Error Tracking**, **CI Visibility** (flaky tests), **Service Catalog**.
- **Custom metrics via DogStatsD**, e.g. `statsd.increment('offers.created', tags=['city:boston'])`, `statsd.histogram('listing.search.ms', ms)`.
- **Our file:** [observability/datadog.compose.yml](../observability/datadog.compose.yml): agent container with APM + logs enabled and the API services getting `DD_AGENT_HOST/DD_SERVICE/DD_ENV` and `NODE_OPTIONS=--require dd-trace/init` (needs `npm i dd-trace` + a key). **Not verified.**
- **What I'd monitor for Hearth:** API request rate/error/latency by route; gRPC `NOT_FOUND` vs `UNAVAILABLE` rates; HAProxy backend up/down and queue time; Temporal workflow failures, schedule-to-start latency, workflow task backlog; Postgres connections/slow queries/replication lag; Kubernetes pod restarts/OOMKills/HPA saturation; Airflow DAG failures/duration; SQS DLQ depth (alert if > 0).
- **Cost control:** drop/limit high-cardinality tags, sample traces, exclude noisy logs, retention tiers.

## Opsgenie (alert management and on-call)
> Atlassian has announced Opsgenie is being phased out in favor of **Jira Service Management** and **Compass** (Atlassian's own product named Compass, unrelated to Compass Real Estate). Check the current dates, but the concepts transfer directly to **PagerDuty**/JSM on-call.
- **Alert flow:** monitoring tool (Datadog) → **integration** → Opsgenie alert (deduplicated by an **alias**) → **routing rules** → **team** → **escalation policy** → **on-call schedule** → notification (push/SMS/voice/email).
- **On-call schedules and rotations:** daily/weekly rotations, overrides, follow-the-sun across time zones. **Escalation policy:** notify primary → if not **acknowledged** within N minutes → secondary → manager. **Priorities** P1-P5 drive notification channels. **Heartbeats** detect when a monitored job/agent stops reporting (dead-man's switch).
- **Acknowledge** (I'm on it) vs **close** (resolved); **snooze**; **maintenance windows** to silence planned work. **Incidents** can group alerts.

## Incident response process
1. **Detect** (alert) → 2. **Triage/severity** (SEV1 customer-impacting outage … SEV4 minor) → 3. **Assign roles:** **Incident Commander** (coordinates, decides), **Ops/Tech lead** (fixes), **Communications lead** (status page/stakeholders), scribe → 4. **Mitigate first** (rollback, feature-flag off, scale up, failover) before root-causing → 5. **Communicate** regularly → 6. **Resolve & verify** → 7. **Blameless postmortem** within days: timeline, impact, root cause(s) (5 whys), what went well/poorly, **action items with owners and dates**.
- **Metrics:** MTTD (detect), MTTA (acknowledge), **MTTR** (recover), change failure rate, deploy frequency (DORA).
- **Runbooks** link from alerts; **game days / chaos testing** build confidence; **follow-the-sun** and fair rotations prevent burnout; **toil** reduction via automation.

## Interview Q&A
**Q: How would you debug a latency spike?** Check dashboards for scope (which service/route/region/version, since when). Compare to recent deploys/changes. Use APM traces for slow spans (DB? downstream gRPC? Temporal?). Check saturation (CPU throttling, connection pools, GC), dependencies' health, queue depths. Mitigate (rollback/scale), then root-cause.

**Q: Metrics vs logs vs traces?** Metrics: cheap, aggregate, alerting/trends. Logs: detailed events for context. Traces: per-request causality across services. Use them together via shared ids/tags.

**Q: What is an SLO and how do you pick one?** A reliability target from the user's perspective based on an SLI; set from what users need and what you can sustain; error budget guides release pace.

**Q: How do you reduce alert fatigue?** Alert on symptoms/SLO burn, deduplicate/group, add runbooks, delete or fix flapping alerts, route by severity, review pages weekly.

**Q: What makes a good postmortem?** Blameless, factual timeline, customer impact, contributing factors (not "human error"), concrete tracked actions, shared widely.

**Q: How do you trace across HAProxy → Koa → Go?** Propagate a request/trace id: HAProxy sets `X-Request-ID`, Koa reuses it and (with dd-trace) forwards trace headers in gRPC metadata, Go interceptor reads it into context/logs.

**Q: High-cardinality tags: why bad?** Each unique tag combination is a new time series → cost and slow queries. Put ids in logs/traces, not metric tags.

**Q: Who gets paged when the DLQ has messages?** Define ownership: the team owning the producer/consumer; page only if user-impacting; otherwise ticket.
