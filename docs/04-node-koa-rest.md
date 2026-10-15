# Node.js, Koa and REST

## Node.js core
- **Single-threaded event loop** + libuv thread pool (file I/O, DNS, crypto, zlib) + OS async I/O. Great for I/O-bound work; CPU-bound work blocks everyone.
- **Event loop phases:** timers → pending callbacks → idle/prepare → **poll** (I/O) → **check** (`setImmediate`) → close callbacks. Between phases: **`process.nextTick` queue, then microtasks (Promises)**. Order: `nextTick` > Promise `.then` > `setTimeout/setImmediate`.
- **async/await** is sugar over Promises. An `async` function always returns a Promise; an exception inside becomes a rejection.
- **Streams** (Readable/Writable/Transform) process data in chunks with **backpressure** (`pipeline()` handles it and errors). Prefer streams for large files.
- **CPU-bound:** `worker_threads`, a separate service, or offload to a queue. **Scaling:** run multiple processes (`cluster`, PM2, or just several containers/pods, which is what this repo does).
- **Errors:** an unhandled rejection / uncaught exception should crash the process (let the orchestrator restart it) after logging; don't swallow.
- **Graceful shutdown:** on `SIGTERM` stop accepting connections, finish in-flight requests, then exit ([server.js](../services/api/src/server.js)).
- **ES modules** (`"type": "module"`, `import/export`) vs CommonJS (`require`).

## Koa core
Koa (from the Express team) is a **minimal** framework: no router, no body parser bundled; it's just middleware + `ctx`.
- **Middleware are async functions `(ctx, next)`** and form an **onion**: code before `await next()` runs on the way in, code after runs on the way out. This makes timing, error handling and response post-processing trivial.
- **`ctx`** wraps request and response: `ctx.query`, `ctx.params` (router), `ctx.body` (setting it sends the response), `ctx.status`, `ctx.state` (per-request scratch space for passing data between middleware).
- **Error handling:** wrap `await next()` in `try/catch` in one outer middleware (our [errorHandler](../services/api/src/middleware/errorHandler.js)). Because middleware are async, errors thrown anywhere downstream bubble up through the onion naturally (in Express callbacks this needed `next(err)`).
- **Koa vs Express:** Koa = async/await-native, smaller core, no callbacks, `ctx` instead of `req/res`, you pick your own router (`@koa/router`) and parsers. Express = bigger ecosystem, batteries included, callback style, `next(err)`.

## Code walkthrough ([services/api](../services/api))
The BFF grew from a proxy into the product's HTTP surface. Structure (every file small, every function ≤ 10 lines):

| Layer | Files | Idea |
|---|---|---|
| **Composition root** | [server.js](../services/api/src/server.js) | The ONLY place that builds real pools/clients and wires them (`buildDeps`); SIGTERM closes server and pool |
| **App factory** | [app.js](../services/api/src/app.js) | `createApp(deps)`: pure function of its dependencies, so tests pass fakes (no DB, no network) |
| **Config** | [config.js](../services/api/src/config.js) | 12-factor env vars; `assertSafe` refuses to boot in production with the default JWT secret |
| **Middleware** | [middleware/](../services/api/src/middleware) | `requestId` → `logger` → `securityHeaders` → `errorHandler` → body parser (JSON only) → `authenticate` |
| **Validation** | [validation.js](../services/api/src/validation.js) | zod schemas; `parse()` throws a 400 with `{field, message}` details; unknown fields dropped |
| **Routes** | [routes/](../services/api/src/routes) | Thin handlers built as `(deps) => async (ctx) => …`; each route is 2-4 lines |
| **Services** | [services/auth.js](../services/api/src/services/auth.js), [offers.js](../services/api/src/services/offers.js) | Business rules (duplicate email → 409, offer guards, saga rollback) |
| **Repos** | [repos/](../services/api/src/repos) | SQL only; parameterized; return plain objects |
| **Clients** | [clients/](../services/api/src/clients) | `inspection.js` (REST + timeout → 503/504), `workflows.js` (Temporal start/query/signal) |
| **gRPC** | [grpcClient.js](../services/api/src/grpcClient.js), [listingService.js](../services/api/src/listingService.js) | Deadline on every call, `round_robin` LB, REST query → proto request mapping |

Middleware order is the onion: the id is created first so even error responses carry it; `errorHandler` sits inside `logger` so the logged status is the final one; the body parser only accepts JSON, which (with SameSite=Lax cookies) closes the CSRF hole for cross-site form posts.

**Auth** ([routes/auth.js](../services/api/src/routes/auth.js)): bcrypt password hashes, JWT in an **httpOnly SameSite=Lax cookie**, per-IP rate limit (20/min), identical error for "unknown email" and "wrong password", and a dummy bcrypt compare so response time doesn't reveal which emails exist.

**Offers saga** ([services/offers.js](../services/api/src/services/offers.js)): insert row → start workflow → on failure delete the row and return 503. Workflow ID `offer-<uuid>` makes retries idempotent.

**Error mapping** ([errorHandler.js](../services/api/src/middleware/errorHandler.js)): gRPC codes → HTTP; `HttpError` messages are user-safe; everything else becomes a generic message (and `details` is only forwarded for our own validation errors: a bug found while testing).

**Tests** (30, `node:test`): real HTTP on an ephemeral port against `createApp` with in-memory fakes ([test/helpers.js](../services/api/test/helpers.js)).

## REST design (core + advanced)
- **Resources & verbs:** nouns in URLs (`/api/listings/L1`), verbs are HTTP methods. `GET` safe+idempotent, `PUT/DELETE` idempotent, `POST` neither, `PATCH` partial update.
- **Status codes:** 200 OK, 201 Created (+`Location`), 204 No Content, 400 bad input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (e.g. double-booked inspection, see the Java service), 422 validation, 429 rate limited, 5xx server (502 bad gateway, 503 unavailable, 504 timeout).
- **Idempotency:** make `POST` safe to retry using an `Idempotency-Key` header and storing the result; essential for payments/offers.
- **Pagination:** offset (simple, slow/unstable on big tables) vs **cursor/keyset** (stable and fast: `WHERE id > :last ORDER BY id LIMIT n`).
- **Caching:** `Cache-Control`, `ETag` + `If-None-Match` → 304; CDN for public GETs.
- **Versioning:** URL (`/v1`), header, or additive-only evolution. **Rate limiting:** token bucket at the edge (HAProxy/API gateway).
- **Auth:** OAuth2/OIDC with JWT access tokens; validate signature, `exp`, `aud`; short-lived tokens + refresh. **CORS** is a *browser* policy: server must allow origins/headers.
- **Security basics:** validate input, parameterized queries, limit payload size, no secrets in logs, HTTPS only, avoid verbose errors.
- **Observability:** request id, structured logs, RED metrics (rate/errors/duration), distributed traces.

## Interview Q&A
**Q: Explain the Node event loop.** One thread runs JS; async I/O is delegated to the OS/libuv; when done, callbacks queue up and run in phases. Microtasks (nextTick, Promises) run between phases. Blocking the loop (heavy JSON/CPU) stalls all requests.

**Q: How do you scale a Node service?** Horizontally: stateless processes behind a load balancer (we run 2 API replicas behind HAProxy; Kubernetes HPA scales on CPU). Use worker threads for CPU spikes. Keep sessions out of process memory.

**Q: Why Koa over Express?** Cleaner async flow and error handling via the onion model, smaller surface, no callback hell. Trade-off: you assemble router/parsers yourself and the ecosystem is smaller.

**Q: Why a BFF (backend-for-frontend)?** Browsers speak REST/JSON; internal services speak gRPC. The BFF aggregates calls, shapes data for the UI, centralizes auth and maps errors. Risk: it can become a monolith; keep it thin.

**Q: How do you avoid cascading failures?** Timeouts/deadlines on every call (2 s here), retries with backoff+jitter only for idempotent calls, circuit breakers, bulkheads, load shedding, health-checked load balancing.

**Q: `process.nextTick` vs `setImmediate` vs Promise?** `nextTick` runs before Promise microtasks, both before the next loop phase; `setImmediate` runs in the check phase after I/O.

**Q: How did you test it?** Unit-test middleware and routes with a faked dependency over real HTTP; contract-test the gRPC edge separately; E2E through HAProxy in Compose.

**Q: PUT vs PATCH vs POST?** PUT replaces (idempotent), PATCH partially updates, POST creates/triggers actions (not idempotent by default).
