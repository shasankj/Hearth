# Hearth

A full-stack real-estate marketplace in the spirit of Zillow, Redfin and Compass: search and map homes, compare, save, book tours, message agents and make offers that run as durable workflows.

> **Demo data.** Every listing, address and agent is fictional (city coordinates are real). Listing photos are generated illustrations; the schema and UI already support real image URLs.


---

## Contents
1. [What you can do](#1-what-you-can-do)
2. [Architecture](#2-architecture)
3. [Technology map](#3-technology-map-what-is-used-where-and-why)
4. [Run it](#4-run-it)
5. [Using AWS RDS](#5-using-aws-rds-instead-of-the-local-database)
6. [Data model](#6-data-model)
7. [API reference](#7-api-reference-rest-bff)
8. [Service contracts](#8-service-contracts-grpc-thrift)
9. [Key flows](#9-key-flows)
10. [Security](#10-security)
11. [Testing](#11-testing)
12. [Deployment: Kubernetes, Terraform, CI](#12-deployment-kubernetes-terraform-ci)
13. [Observability and operations](#13-observability-and-operations)
14. [Code conventions](#14-code-conventions)
15. [Roadmap and honest limitations](#15-roadmap-and-honest-limitations)
16. [Repository layout](#16-repository-layout)

---

## 1. What you can do

| Area | Features |
|---|---|
| **Search** | Free-text (full-text + prefix), city/neighborhood/ZIP, status tabs (Buy / Rent / Sold), price range, beds, baths, property type, size, year built, features (pool, garage, waterfront…), open-house only, 5 sort orders, infinite scroll, **filters live in the URL** (shareable, Back button works), typeahead suggestions |
| **Map** | Interactive OpenStreetMap with price pins, list/split/map views, hover-to-highlight, click-to-preview, **"Search this area"** (viewport becomes a filter) |
| **Listing page** | 5-scene photo gallery + lightbox (arrow keys), facts, open-house banner, **price-history chart**, location map, neighborhood vs city median, agent card, **similar homes**, share |
| **Money tools** | Mortgage calculator with tax/insurance/HOA breakdown, **affordability calculator**, per-card monthly estimate, price-drop and "below average" signals |
| **Engagement** | Book a tour, message the agent (works signed-out), **3-step offer wizard** |
| **Accounts** | Register/sign in (httpOnly session cookie), saved homes (synced across devices, merged from local on sign-in), saved searches with alert toggle, recently viewed, **My activity** |
| **Offers** | Each offer starts a **Temporal workflow**: hold listing → inspection → wait for financing (72 h durable timer) → close; live timeline in the UI; saga compensation on failure |
| **Compare** | Up to 3 homes side by side with best values highlighted |
| **Market** | Median price, $/sqft and days-on-market per city (bar charts), table, nightly analytics ETL (Airflow) |
| **UX / quality** | Dark/light theme (follows OS), skeleton loaders, empty/error/offline states with recovery, toasts, keyboard shortcut (`/`), focus-trapped dialogs, ARIA roles, reduced-motion support, responsive down to phones |

---

## 2. Architecture

```
                         ┌────────────────────────────────────────────────────────┐
 Browser (React 19) ────▶│ HAProxy :8080  (round-robin, health checks, ACLs,       │
 Vite dev :5173 proxies  │                 X-Request-ID, X-Forwarded-For)          │
                         └───────┬───────────────────────────┬────────────────────┘
                                 │ /api/*                    │ /inspections*
                       ┌─────────▼─────────┐                 │
                       │ Koa BFF  (x2)     │                 │
                       │ REST/JSON, auth,  │──REST (3s timeout)──▶ Inspection svc (Java)
                       │ validation, rate  │                          │  tours  (UNIQUE listing+date)
                       │ limit, sessions   │                          ▼
                       └──┬───────┬────┬───┘                      ┌───────────────────────────┐
              gRPC (2s    │       │    │ Temporal client           │  PostgreSQL 16            │
              deadline,   │       │    │ (start/query/signal)      │  (local container or RDS) │
              round_robin)│  pg   │    ▼                           │  listings, agents, users, │
                          │       │  ┌───────────────┐             │  favorites, searches,     │
              ┌───────────▼──┐    │  │ Temporal      │             │  inquiries, tours, offers,│
              │ Listing svc  │────┼─▶│ server        │             │  price_history, analytics │
              │ (Go, gRPC)   │ pgx│  └──────┬────────┘             └───────────▲───────────────┘
              └──────────────┘    │         │ task queue "offers"              │
                                  │  ┌──────▼──────────┐                       │
                                  │  │ Offer worker    │ (Go: workflow +       │
                                  │  │                 │  activities, saga)    │
                                  │  └─────────────────┘                       │
                                  └────────────────────────────────────────────┘
 Pricing svc (Go, Thrift)  ── standalone estimate service       Airflow DAG ─▶ analytics.city_stats
 Agent svc (Python)        ── LLM tool-calling over the REST API (needs an API key to run live)
```

**Why this shape**
- **BFF (Koa)** gives the browser one simple REST/JSON surface, centralizes auth, validation and error mapping, and hides internal protocols (gRPC, Temporal, REST-to-Java).
- **Listing service (Go + gRPC)** owns the hot read path: typed contract, deadlines, tiny static binary, fast SQL via pgx.
- **Inspection service (Java)** owns tour bookings; the database `UNIQUE (listing_id, date)` constraint, not a JVM lock, guarantees no double booking across replicas.
- **Temporal** owns the multi-day offer process: durable timers, retries, compensation, and a queryable status.
- **Postgres** is the single source of truth. Search is plain SQL (GIN full-text + B-tree + array indexes). At larger scale you would add an OpenSearch index fed by CDC (see roadmap).

---

## 3. Technology map: what is used where and why

| Tech | Where in this repo | Why |
|---|---|---|
| **React 19** + Vite + React Router | [web/](web) | SPA with route-level code splitting; React 19 form actions, `useActionState`, `useEffectEvent` |
| **Leaflet / OpenStreetMap** | [web/src/components/MapView.jsx](web/src/components/MapView.jsx) | Free, no API key; price pins via `divIcon` |
| **Cypress** | [web/cypress](web/cypress) | E2E: stubbed-network tests plus tests against the real stack |
| **Koa** (Node 24) | [services/api](services/api) | Async middleware "onion", tiny core, easy to test with injected fakes |
| **REST** | BFF | Browser-friendly, cacheable, simple |
| **gRPC + Protobuf** | [proto/listing/v2](proto/listing/v2/listing.proto), [services/listing](services/listing) | Typed internal contract, deadlines, streaming, client-side load balancing |
| **Go** | listing, pricing, offer worker | Concurrency, small images, first-class gRPC/Temporal SDKs |
| **Thrift** | [proto/thrift](proto/thrift/pricing.thrift), [services/pricing](services/pricing) | Demonstrates the second RPC stack (legacy-style IDL, pluggable protocol/transport) |
| **Java 21** | [services/inspection](services/inspection) | Records, JDBC, thread-safe booking; dependency-free HTTP server |
| **Python** | [services/agent](services/agent), [airflow/](airflow) | Agentic-AI tool loop (guardrails, tests with a scripted LLM); Airflow DAG |
| **Temporal** | [services/offer](services/offer) | Durable offer workflow: timer + signal + query + saga |
| **PostgreSQL** | [infra/postgres](infra/postgres) | ACID store, full-text search, JSONB, arrays. **TablePlus** connects here |
| **Redshift / Databricks** | docs only | Warehouse concepts; the ETL targets `analytics.city_stats` as a stand-in |
| **Airflow** | [airflow/dags](airflow/dags) | Daily ETL listings → analytics; logic unit-tested separately |
| **HAProxy** | [infra/haproxy](infra/haproxy/haproxy.cfg) | L7 load balancing, health checks, request IDs, ACL routing |
| **Docker / Compose** | Dockerfiles, [docker-compose.yml](docker-compose.yml) | Reproducible local environment |
| **Kubernetes** | [k8s/](k8s) | Deployments, probes, HPA, PDB, headless Service for gRPC |
| **Terraform / AWS** | [terraform/](terraform) | S3 data lake, SQS+DLQ, IAM, RDS module; runs against LocalStack |
| **CircleCI** | [.circleci](.circleci/config.yml) | Parallel test jobs, cached deps, gated image build |
| **Datadog / Opsgenie** | [observability](observability/datadog.compose.yml), docs | Agent config + operational guidance (not run) |

Deep dives for every technology (core + advanced concepts, code walkthroughs, interview Q&A) are in [docs/](docs/00-START-HERE.md).

---

## 4. Run it

### Prerequisites
Docker (or Colima), Node 20+, Go 1.22+ (only to run Go tests), JDK 21 (only to run Java tests). On Apple silicon/Intel Macs without Docker Desktop: `colima start --cpu 3 --memory 6`.

### Start the backend
```bash
docker compose up -d --build        # first build takes several minutes
docker compose ps                   # every service should be Up (postgres: healthy)
curl 'localhost:8080/api/listings?city=Boston&pageSize=2'
```

### Start the web app
```bash
cd web
npm install
npx vite --port 5173                # http://localhost:5173
```
Vite proxies `/api` and `/inspections` to HAProxy on `:8080` (`API_URL=... npx vite` to change).

### Handy URLs
| What | URL |
|---|---|
| App | http://localhost:5173 |
| API through HAProxy | http://localhost:8080/api/listings |
| HAProxy stats | http://localhost:8404 |
| Temporal UI | http://localhost:8233 |
| Postgres (TablePlus) | host `localhost`, port `5432`, user/password/database `hearth` |
| gRPC | `grpcurl -plaintext localhost:50051 list` |

### Reset the database
Schema and seed run **once**, when the Postgres volume is first created.
```bash
docker compose down -v && docker compose up -d     # wipes data and re-seeds
python3 infra/postgres/gen_seed.py > infra/postgres/002_seed.sql   # regenerate the seed (deterministic)
```

### Try an offer end to end
1. Register at `/register`, open any **for-sale** home, press **Make an offer**, finish the wizard.
2. Go to **My activity → Offers**: the timeline sits on *Financing*.
3. Press **Simulate lender approval** (a real Temporal *signal*): the workflow closes the deal and the timeline completes. Watch it in the Temporal UI too.

### Environment variables (BFF)
| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://hearth:hearth@localhost:5432/hearth` | Postgres / RDS |
| `LISTING_ADDR` | `localhost:50051` | gRPC listing service (`dns:///host:port` for k8s headless) |
| `INSPECTION_URL` | `http://localhost:8081` | Java service |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal frontend |
| `JWT_SECRET` | dev value (refused when `NODE_ENV=production`) | Session signing key |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `TRUST_PROXY` | `false` | Set `true` behind HAProxy/ALB so client IPs are correct |
| `BCRYPT_ROUNDS` | `10` | Password hashing cost |

Go listing service: `DATABASE_URL`, `LISTING_ADDR`. Java: `JDBC_URL`, `DB_USER`, `DB_PASSWORD`, `PORT`. Offer worker: `TEMPORAL_ADDRESS`.

---

## 5. Using AWS RDS instead of the local database

The app only needs a PostgreSQL 14+ URL, so RDS is a configuration change.

1. **Create** an RDS PostgreSQL instance (or Aurora PostgreSQL). Free-tier `db.t4g.micro` is enough. Put it in a VPC whose security group allows inbound **5432 from your app** (and from your IP for TablePlus).
2. **Create the database and load the schema once** (from your laptop, or a bastion/CI job):
   ```bash
   export PGPASSWORD='…'
   psql "host=<endpoint> user=hearth dbname=hearth sslmode=require" -f infra/postgres/001_schema.sql
   psql "host=<endpoint> user=hearth dbname=hearth sslmode=require" -f infra/postgres/002_seed.sql
   ```
3. **Point the services at it** (keep passwords in a secret store, never in git):
   ```yaml
   listing:    DATABASE_URL: "postgres://hearth:<pw>@<endpoint>:5432/hearth?sslmode=require"
   api1/api2:  DATABASE_URL: (same)
   inspection: JDBC_URL: "jdbc:postgresql://<endpoint>:5432/hearth?sslmode=require"  DB_USER / DB_PASSWORD
   ```
   Remove the `postgres` container and its `depends_on` entries (or leave it running unused).
4. **Terraform:** [terraform/modules/rds](terraform/modules/rds/main.tf) creates the instance, subnet group and security group (encryption on, no public access by default, password generated by AWS Secrets Manager). It is **validated but not applied**, because applying it creates billable resources. Review `terraform plan` first.
5. **Production notes:** use `rds.force_ssl`, a least-privilege app user (not the master user), a connection pooler (RDS Proxy or PgBouncer) once you have many replicas, Multi-AZ, automated backups, and Performance Insights.

> Never paste database credentials into chat, issues or commits. Use environment variables, AWS Secrets Manager or a `.env` file excluded by `.gitignore`.

---

## 6. Data model

```
agents ─┐
        └─< listings >─┬─< price_history        (listed, price_change, pending, sold)
                       ├─< favorites >─ users
                       ├─< inquiries           (user optional)
                       ├─< tours               (UNIQUE listing_id+date; owned by Java svc)
                       └─< offers >─ users     (workflow_id → Temporal)
users ─< saved_searches (query JSONB, alerts)
analytics.city_stats (day, city) ← Airflow upsert
```

Highlights ([001_schema.sql](infra/postgres/001_schema.sql)):
- `listings.price_usd` is the sale price **or monthly rent** (`status = for_rent`); money is always integer `BIGINT`.
- `listings.tsv` is a **generated tsvector** (address + city + neighborhood + description) with a GIN index; `features` is `TEXT[]` with GIN (`features @> ARRAY[...]` = "has all of these").
- `CHECK` constraints enforce enums and positive prices; FKs protect integrity; `ON DELETE CASCADE/SET NULL` is chosen per table.
- "Price drop" is **derived**: the listing query computes the previous price from `price_history` (a correlated subquery) instead of denormalizing.

---

## 7. API reference (REST BFF)

All JSON. Errors: `{ "error": "message", "details": [{field, message}], "id": "<request id>" }`. Session = cookie `hearth_session` (httpOnly, SameSite=Lax).

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/listings` | – | Search. Query: `q, status, city, types, features, minPrice, maxPrice, beds, baths, minSqft, maxSqft, minYear, north/south/east/west, openHouse, sort, page, pageSize` → `{listings, total, page, pageSize}` |
| `GET /api/listings/batch?ids=a,b` | – | Up to 24 homes by id (saved / recently viewed) |
| `GET /api/listings/:id` | – | Detail: agent + price history |
| `GET /api/listings/:id/similar` | – | Same city/type/status, ±30% price |
| `GET /api/market` | – | Per-city median, avg $/sqft, avg days on market (cached 60 s) |
| `POST /api/auth/register` `login` `logout`, `GET /api/auth/me` | – | Sessions (rate limited: 20/min/IP) |
| `GET/PUT/DELETE /api/me/favorites[/:listingId]`, `GET …/favorites/listings` | ✔ | Saved homes |
| `GET/POST /api/me/saved-searches`, `PATCH/DELETE …/:id` | ✔ | Saved searches + alert toggle |
| `POST /api/inquiries` | optional | Message the agent (10/min/IP) |
| `POST /api/tours` | optional | Book a tour → Java service (`409` if the date is taken) |
| `POST /api/offers` | ✔ | Create offer + start Temporal workflow (`409` not for sale, `400` too low, `503` workflow unavailable → rolled back) |
| `POST /api/offers/:id/approve-financing` | ✔ | Signal the workflow (demo stand-in for a lender integration) |
| `GET /api/me/activity` | ✔ | Offers (with live workflow step), tours, messages |
| `GET /healthz` | – | Probe target |

Status mapping: gRPC `NOT_FOUND→404`, `INVALID_ARGUMENT→400`, `DEADLINE_EXCEEDED→504`, `UNAVAILABLE→503`; unknown errors → `500` with a generic message (details only in logs).

---

## 8. Service contracts (gRPC, Thrift)

**gRPC** [`hearth.listing.v2.ListingService`](proto/listing/v2/listing.proto): `GetListing`, `GetListings`, `SearchListings`, `SimilarListings`, `MarketStats`, `StreamListings` (server streaming). Rules: never reuse field numbers; breaking changes go to a new package version (`v2` replaced `v1` because the `Listing` message changed incompatibly). The Go server validates input, maps domain errors to status codes and never leaks internals.

**Thrift** [`PricingService.estimate`](proto/thrift/pricing.thrift) with a typed `InvalidInput` exception. Compiler/library versions must match (0.12.0 here).

**Temporal** workflow `OfferWorkflow(Input{OfferID, ListingID, BuyerID, AmountUSD})` on task queue `offers`; signal `financing-approved`; query `status` → `submitted | inspection | awaiting_financing | closing | closed | expired`.

---

## 9. Key flows

**Search** `React → HAProxy → Koa (validate query with zod) → gRPC SearchListings (2 s deadline) → Go builds a parameterized SQL query from a whitelist → Postgres`. The Go layer never concatenates user input into SQL; sort keys come from a fixed map.

**Offer** (saga + durable execution)
1. BFF validates, checks the listing is `for_sale` and the amount is sane, inserts the `offers` row.
2. BFF starts `OfferWorkflow` (ID `offer-<uuid>` → idempotent). If starting fails, the row is deleted and the user gets `503`.
3. Worker: `HoldListing` → `ScheduleInspection` → waits for the signal **or** a 72-hour timer.
4. Signal → `CloseDeal` → `closed`. Timeout → `expired`. Any activity failure after 5 retries → `ReleaseListing` (compensation).
5. The UI polls `/api/me/activity`, which **queries** each workflow for its current step.

**Tour booking** `React → BFF → Java (REST, 3 s timeout) → INSERT … ON CONFLICT DO NOTHING`. Zero rows inserted means that day is taken → `409`.

**Favorites** Signed out: `localStorage`. Signed in: server-side with optimistic updates and rollback; local favorites are merged into the account on sign-in.

---

## 10. Security

- Passwords: **bcrypt** (cost 10), constant-time-ish login (dummy hash for unknown emails, one error message for both cases).
- Sessions: signed JWT in an **httpOnly, SameSite=Lax** cookie, 7-day expiry; `Secure` when `COOKIE_SECURE=true`. The server **refuses to start in production with the default secret**.
- **CSRF:** SameSite=Lax plus JSON-only body parsing (cross-site HTML forms cannot send JSON).
- **Input validation** everywhere with zod; unknown fields dropped; page size and list lengths capped.
- **SQL injection:** parameterized queries; dynamic `ORDER BY` from a whitelist (unit-tested with a hostile string).
- **Rate limiting:** auth endpoints and inquiries (in-memory per instance; use HAProxy stick tables or Redis for multi-instance accuracy).
- **Headers:** `nosniff`, `X-Frame-Options: DENY`, referrer and permissions policies. Add a CSP and HSTS at the edge for production.
- **Errors:** generic 5xx bodies; details only in server logs; request IDs for correlation.
- **Containers:** non-root numeric users, read-only root filesystem in k8s, no privilege escalation.
- **Least privilege:** IAM policy in Terraform scoped to one queue and two actions.

---

## 11. Testing

| Suite | Command | What it covers |
|---|---|---|
| Go listing | `TEST_DATABASE_URL=postgres://hearth:hearth@localhost:5432/hearth go test ./services/listing` | SQL builder (injection, paging, placeholders), **integration against real Postgres** (filters, sort, full-text, detail, similar, market), gRPC error codes, streaming |
| Go pricing | `go test ./services/pricing` | Real Thrift client ↔ server, typed exception |
| Go offer | `go test ./services/offer` | Temporal test env: approve, 72 h timeout (instant), saga compensation, status query |
| Koa API | `cd services/api && npm test` | 30 tests with in-memory fakes: validation, auth cookies, favorites, saved searches, tours (409), offers (guards, rollback, signal), error mapping, rate limit |
| Java | `javac … && java -ea … InspectionTest` | Booking contract in memory **and Postgres**, 20-thread race (exactly one wins) |
| Python | `cd services/agent && PYTHONPATH=. python3 -m unittest discover -s tests` | Agent loop, tool allow-list, step limit |
| Airflow logic | `python3 -m unittest discover -s airflow/tests` | ETL transforms |
| Cypress E2E | `cd web && npx cypress run` (Vite on :5173, stack up) | **27 tests**: 23 with a stubbed network (filters in URL, infinite scroll, compare, gallery, forms, auth, offer wizard) and 4 on the real stack (search, full-text, market, and a full register → favorite → tour 409 → offer → workflow closed journey) |
| Quality gate | `python3 ../scripts/check_function_length.py .` | Every function ≤ 10 lines |

Cypress note: VS Code terminals set `ELECTRON_RUN_AS_NODE=1`; run `unset ELECTRON_RUN_AS_NODE` first.

---

## 12. Deployment: Kubernetes, Terraform, CI

- **Kubernetes** ([k8s/](k8s)): Deployments with rolling updates (`maxUnavailable: 0`), readiness/liveness (native gRPC probes for the listing service), requests/limits, `runAsNonRoot` with numeric UID, HPA (2–6 pods at 70% CPU), PodDisruptionBudget, **headless Service** + client-side `round_robin` so gRPC spreads load across pods. Apply with `kubectl apply -k k8s` (images must be loadable by the cluster; for kind use `kind load docker-image`). Add Secrets for `DATABASE_URL`/`JWT_SECRET` and Deployments for inspection and the offer worker before real use.
- **Terraform** ([terraform/](terraform)): S3 data lake (versioned, public access blocked), SQS + DLQ module, least-privilege IAM, optional RDS module. `use_localstack=true` targets LocalStack; set `false` plus an AWS profile for real AWS, and add a remote state backend (S3 + locking) first.
- **CI** ([.circleci/config.yml](.circleci/config.yml)): Go, Node, Python, Java and Cypress jobs run in parallel with dependency caching; image builds run only on `main` after all tests pass.

---

## 13. Observability and operations

- Every request carries `X-Request-ID` (HAProxy → Koa → logs and error bodies).
- Go logs method, duration and error per RPC; the Java service logs stack traces for 5xx only.
- Probes: `/healthz` (HAProxy, Kubernetes), gRPC health service (`grpc.health.v1`).
- Datadog agent compose override is provided ([observability/datadog.compose.yml](observability/datadog.compose.yml)); see [docs/15](docs/15-datadog-opsgenie.md) for what to monitor (error rate and latency per route, gRPC `UNAVAILABLE`, Temporal schedule-to-start latency and failures, SQS DLQ depth, Postgres connections).
- Graceful shutdown in Go (`GracefulStop`), Node (`SIGTERM` closes server and pool) and Kubernetes (`maxUnavailable: 0`).

---

## 14. Code conventions

- **Every function is 10 lines or fewer** (enforced by `scripts/check_function_length.py`). The result is many small, named, individually testable pieces.
- Dependency injection at the edges: `createApp(deps)`, `makeXService(client)`, Go `Repo` interface, Java `TourStore` port. Only `server.js` (composition root) knows the concrete implementations.
- Errors are values: domain errors at the core, translated to transport codes at the boundary.
- Comments explain **why**, not what.

---

## 15. Roadmap and honest limitations

**Not built (and what I would do next)**
- **Real photos and uploads:** S3 presigned uploads → image resize pipeline → CDN; `listings.photos` and the `<Photo>` component are ready.
- **Search at scale:** OpenSearch index fed by CDC (Debezium) for typo tolerance, ranking, facets and geo-sort; keyset pagination.
- **Saved-search alerts:** the alert flag is stored but no email is sent. Next: a Temporal schedule or CDC consumer that matches new listings to saved searches and sends via SES.
- **Agent/seller side:** listing creation and editing, lead inbox, MLS/IDX feed ingestion, offers visible to agents (today the buyer simulates lender approval).
- **Payments / e-sign / documents**, notifications (push/SMS), reviews, neighborhood data (schools, walk score), school and crime layers.
- **Server-side rendering** for SEO on listing pages (Next.js or Remix), structured data (JSON-LD), sitemap.
- **Auth hardening:** email verification, password reset, refresh/rotation, OAuth, MFA; distributed rate limiting; CSP and HSTS at the edge.
- **Kubernetes parity:** manifests for the BFF's new secrets, inspection and offer worker; Helm or Kustomize overlays; Ingress with TLS (cert-manager).
- **Datadog, Opsgenie, Databricks, Redshift** are covered in documentation only.
- The Python agent's live Claude adapter has not been run (no API key); its loop and guardrails are unit-tested.

**Known simplifications:** in-memory rate limiter (per instance); Java service opens a connection per request (use HikariCP); offer worker activities are logging stubs (they would call the listing/inspection services); amounts above the asking-price guard are not negotiated; no pagination on activity lists.

---

## 16. Repository layout

```
hearth/
├── proto/                 gRPC (listing v2) and Thrift (pricing) contracts
├── gen/                   generated code (do not edit)
├── services/
│   ├── api/               Koa BFF: routes, validation, auth, repos, clients, tests
│   ├── listing/           Go gRPC service on Postgres (pgx)
│   ├── pricing/           Go Thrift service
│   ├── offer/             Go Temporal workflow, activities, worker, starter
│   ├── inspection/        Java tour-booking service (JDBC)
│   └── agent/             Python LLM agent (tool loop, guardrails)
├── web/                   React app (Vite), Cypress tests
├── airflow/               DAG + unit-tested ETL logic
├── infra/                 HAProxy config, Postgres schema + seed generator
├── k8s/                   Kubernetes manifests (kustomize)
├── terraform/             S3, SQS+DLQ, IAM, RDS module (LocalStack-ready)
├── observability/         Datadog agent override
├── docs/                  Study guides: one per technology
└── docker-compose.yml
```
