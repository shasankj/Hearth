# System design and behavioral prep (senior SWE)

## A framework you can use for any design question (≈45 min)
1. **Clarify requirements** (functional + non-functional: scale, latency, consistency, availability). Ask who the users are and what matters most.
2. **Estimate scale** (users, QPS, data size) to choose architecture. Keep it rough.
3. **API & data model** first (entities, relationships, main queries).
4. **High-level diagram** (clients → edge → services → data stores → async pipelines).
5. **Deep-dive** the 1-2 hardest parts (the interviewer will steer).
6. **Bottlenecks & failure modes:** caching, sharding, replication, retries/idempotency, backpressure, observability, security.
7. **Trade-offs explicitly** ("I chose X over Y because ...; the cost is ...").

Core toolbox: load balancer, CDN, cache (Redis; cache-aside/write-through; TTL, invalidation, stampede protection), queue/stream (SQS/Kafka), RDBMS vs NoSQL, search index (Elasticsearch/OpenSearch), object storage (S3), CDC, rate limiting, idempotency keys, circuit breakers, CQRS, sagas, eventual consistency, CAP/PACELC.

## Likely design questions (Compass-flavored) with sketches

### 1. Property search (the core product)
- **Requirements:** filter by location/price/beds, free text, map viewport, sort, pagination; millions of listings, read-heavy (maybe 1000:1), results < 300 ms, listing data freshness within minutes (MLS feeds).
- **Design:** source of truth = Postgres. **CDC** (Debezium → Kafka) or the Airflow/batch job keeps a **search index** (OpenSearch) updated: geo queries (`geo_bounding_box`/geohash), filters, facets, relevance/ranking. API (Koa BFF) → search service → index; **cache** hot queries in Redis/CDN; details page by id from Postgres + cache. **Keyset pagination**. Images via S3 + CDN + resizing pipeline.
- **Trade-offs:** index freshness vs cost; denormalized documents; reindex strategy with aliases (zero downtime); eventual consistency is fine for search, not for offers.

### 2. Offer / transaction workflow (what we built)
- **Requirements:** multi-step, days long, human approvals, must not lose state, no double-accept.
- **Design:** **Temporal workflow per offer** (ID = offer id → dedup), activities call services; signals for approvals; timers for deadlines; saga for compensation; **idempotent** activities; audit trail from workflow history; status read via **query** or projected into Postgres for UI.
- **Failure modes:** worker crash (replay), duplicate submit (workflow ID reuse policy), listing sold mid-flow (compensate), poison payloads (DLQ/non-retryable errors).

### 3. Saved-search alerts / notifications
- **Flow:** listing change event → match against saved searches (reverse search / percolator query in OpenSearch) → enqueue notifications → dedupe/rate-limit per user → send via email/SMS/push providers with retries. **At-least-once + idempotency key** to avoid duplicates; preference center; backoff for provider outages; DLQ.

### 4. Photo / document upload
- Client gets a **presigned S3 URL** → uploads directly → S3 event → SQS → workers resize/virus-scan → metadata in DB → CDN. Resumable multipart for big files; private docs with short-lived signed URLs and encryption.

### 5. Rate limiter / API gateway
Token bucket per API key/IP in HAProxy stick tables or Redis (atomic Lua); return `429` + `Retry-After`; distributed consistency vs accuracy trade-off.

### 6. Analytics / data platform
Operational DBs → CDC/ETL (Airflow) → S3 data lake (Delta/Parquet) → Databricks/Redshift for BI; **medallion layers**; data quality checks; PII governance; reverse-ETL back to product.

## Cross-cutting talking points
- **Consistency:** strong where money/legal state is involved (offers, payments); eventual for search/feeds.
- **Idempotency & retries** everywhere with exponential backoff + jitter; **timeouts** on every call; **circuit breakers/bulkheads**.
- **Evolvability:** versioned contracts (protobuf field numbers, `v1` packages), expand/contract DB migrations, feature flags.
- **Security:** authn/authz at the edge, least privilege between services (mTLS), PII encryption, audit logs.
- **Operability:** health checks, structured logs with request ids, RED metrics, SLOs, runbooks, graceful shutdown, zero-downtime deploys.
- **Cost awareness.**

## "Tell me about this project" (60-second pitch for tomorrow)
> "I built Hearth, a mini real-estate platform that mirrors a production stack. A React app calls a Koa BFF behind HAProxy; the BFF talks gRPC to a Go listing service with deadlines and client-side load balancing; a Thrift pricing service; a Temporal workflow handles the multi-day offer process with a saga for compensation; a Python agent uses tool-calling with guardrails; a Java service handles inspection scheduling with thread-safe booking; Airflow loads analytics into a warehouse schema. Everything is containerized, deployed to Kubernetes, provisioned with Terraform, tested in CI (CircleCI config) and I verified it end-to-end: for example I found and fixed a gRPC load-balancing issue where all traffic hit one pod, and a Kubernetes non-root user bug."
Be honest about what you ran vs. studied (see `00-START-HERE.md` table).

## Behavioral (STAR: Situation, Task, Action, Result; keep it to ~2 min, focus on *your* actions and measurable results)
Prepare **one story each** for:
1. **Technical leadership / driving a project** without formal authority.
2. **Disagreement** with a teammate/manager and how it resolved (data-driven, disagree-and-commit).
3. **Failure / production incident** you caused or handled (blameless; what you changed afterward).
4. **Ambiguity:** you had unclear requirements and made progress.
5. **Mentoring** / raising the bar (code reviews, docs, pairing).
6. **Tight deadline / trade-off** (what you cut and why).
7. **Learning something fast** (this prep is itself an example: learning ~15 technologies and shipping a verified project in a day).
8. **Customer impact / business thinking** (tie engineering decisions to user or revenue outcomes).

Strong senior signals: you **clarify before building**, **quantify impact**, **own outcomes**, **write things down**, **raise risks early**, **simplify** (≤10-line functions, thin BFF, boring tech).

## Questions to ask them
- How are services deployed and how often (deploy frequency, rollback)? What's the on-call load and how are incidents reviewed?
- Which parts of the Go/Node/Java mix are migrating where? How do Thrift and gRPC coexist?
- How do you decide build vs buy (Temporal Cloud vs self-hosted)? How is the data platform (Redshift/Databricks) owned?
- How is AI/agentic work evaluated and governed here?
- What does success look like in the first 90 days?

## Last-night checklist
- [ ] Re-read `00-START-HERE.md` (architecture + honest verification table + the 8 bugs/stories).
- [ ] Skim the ★ docs' "Interview Q&A" sections aloud.
- [ ] Prepare 3 STAR stories and the 60-second pitch.
- [ ] Be ready to draw: the Hearth architecture, a Temporal workflow with signal+timer, gRPC load-balancing in Kubernetes, and the Airflow→warehouse flow.
- [ ] Sleep.
