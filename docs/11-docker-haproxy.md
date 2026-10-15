# Docker and HAProxy

## Docker core
- A **container** = a normal Linux process isolated with **namespaces** (pid, net, mnt, uts, ipc, user: what it can *see*) and limited by **cgroups** (CPU, memory, I/O: what it can *use*). It shares the host kernel (unlike a VM, which has its own kernel) → starts in milliseconds, small.
- **Image:** read-only stack of **layers** (union filesystem). **Container** = image + thin writable layer. Layers are cached by instruction; order Dockerfile steps from least to most frequently changing.
- **Dockerfile essentials:** `FROM`, `WORKDIR`, `COPY`, `RUN`, `ENV`, `ARG` (build time), `EXPOSE` (docs only), `USER`, `ENTRYPOINT` (the executable) vs `CMD` (default args), `HEALTHCHECK`.
- **Multi-stage builds:** compile in a big image, copy only the artifact into a tiny runtime image (smaller, fewer vulnerabilities).
- **Networking:** default bridge; user-defined networks give **DNS by service name** (Compose: `listing:50051`). Publish ports with `-p host:container`.
- **Storage:** **volumes** (managed, persistent), **bind mounts** (host path), tmpfs. Container filesystems are ephemeral → data in volumes or external DB.
- **Compose:** declarative multi-container dev environments (`docker compose up`): services, networks, volumes, `depends_on` (start order only; use healthchecks for readiness).
- **Security:** non-root `USER`, minimal base (alpine/distroless), pin versions, scan images (Trivy), no secrets baked into layers, read-only root FS, drop capabilities.
- **PID 1 / signals:** the app must handle `SIGTERM` for graceful shutdown (we do in Go and Node). Use exec-form `CMD ["node","..."]` (not shell form) so signals reach the process.
- **Layer cache tip:** copy `go.mod/go.sum` and `package*.json` first, install dependencies, *then* copy source → dependency layer is reused when only code changes.

## Our Dockerfiles
**[services/go.Dockerfile](../services/go.Dockerfile)**: stage 1 `golang:1.27-alpine` downloads modules (own layer) and builds `CGO_ENABLED=0` static binary for `ARG PKG` (one Dockerfile builds listing, pricing and offer-worker). Stage 2 `alpine`, **numeric non-root user `10001`**, copy binary. One file, three services.
**[services/api/Dockerfile](../services/api/Dockerfile)**: `npm ci --omit=dev` (reproducible, no dev deps); copies `proto/` because the API loads the `.proto` at runtime; runs as `node` user.
**[services/inspection/Dockerfile](../services/inspection/Dockerfile)**: JDK to compile, **JRE only** to run.
**[docker-compose.yml](../docker-compose.yml)**: Postgres (seeded by `init.sql`, healthcheck), listing, pricing, inspection, **api1/api2 via a YAML anchor** (`&api` / `*api` reuse), haproxy, Temporal dev server, offer worker.

### Gotchas hit
- The legacy builder treats `USER app # comment` as part of the instruction → keep comments on their own lines.
- A file named `Dockerfile.go` made Go tools try to parse it as Go; renamed to `go.Dockerfile`.
- Colima (not Docker Desktop) because macOS 13: `colima start --vm-type vz`.

## HAProxy core
- **High-performance L4/L7 load balancer and reverse proxy.** Event-driven, single process/multi-thread. Used for HA, TLS termination, routing, rate limiting.
- **Config sections:** `global` (process settings), `defaults`, **`frontend`** (listens on ports, decides where requests go), **`backend`** (pool of servers + algorithm), `listen` (frontend+backend combined), `resolvers`.
- **Modes:** `mode tcp` (L4: any protocol, fastest, TLS passthrough) vs `mode http` (L7: can inspect/route on path, headers, cookies).
- **Algorithms:** `roundrobin`, `leastconn` (best for long-lived/uneven requests), `source` (IP hash), `uri`, `random`. **Sticky sessions** via cookies or **stick tables**.
- **Health checks:** `check` (TCP) or `option httpchk GET /healthz`; `inter/fall/rise` control frequency and thresholds → unhealthy servers are removed automatically (**this is the HA**).
- **ACLs:** conditions (`path_beg`, `hdr`, `src`) used for routing/blocking: `acl is_inspection path_beg /inspections` → `use_backend inspection`.
- **Timeouts** (`connect`, `client`, `server`) are crucial; missing ones = hung connections. **Rate limiting/abuse protection:** stick tables with request-rate counters → `http-request deny`.
- **TLS termination** with certificates at the frontend; HTTP/2 support; redirect HTTP→HTTPS.
- **High availability of HAProxy itself:** run two instances with **keepalived/VRRP** (floating virtual IP) or put behind a cloud LB/DNS failover. **Runtime API** (admin socket) to drain/enable servers without reload; **seamless reloads**.
- **HAProxy vs Nginx:** both do reverse proxy/LB; HAProxy is purpose-built for load balancing (advanced health checks, stick tables, detailed stats/metrics), Nginx doubles as web/static server and cache. **vs ALB/Envoy:** ALB is managed AWS L7; Envoy is dynamic (xDS) and mesh-oriented.

## Our config ([infra/haproxy/haproxy.cfg](../infra/haproxy/haproxy.cfg))
- `default-server inter 3s fall 3 rise 2`: check every 3 s; 3 failures = down, 2 successes = up.
- `resolvers docker` + `init-addr libc,none`: use Docker's DNS (`127.0.0.11`) and **don't refuse to start if a backend isn't resolvable yet** (the original failed with "could not resolve address 'api2'").
- `unique-id-format` + `unique-id-header X-Request-ID`: HAProxy stamps each request; Koa's `requestId` middleware reuses it → one id across tiers (verified live).
- `frontend public :8080` with ACL: `/inspections*` → Java backend; everything else → `api` backend (`roundrobin`, `httpchk GET /healthz`, servers api1/api2).
- `frontend stats :8404`: dashboard + CSV (we read it: all servers `UP`).
- Verified: 4 requests → api1 got 2, api2 got 2.

## Interview Q&A
**Q: Container vs VM?** Containers share the host kernel and isolate with namespaces/cgroups: lightweight, fast. VMs virtualize hardware with their own kernel: stronger isolation, heavier.

**Q: How do you shrink a Docker image?** Multi-stage builds, small bases (alpine/distroless/scratch), remove build tools, combine `RUN` steps/clean caches, `.dockerignore`.

**Q: `CMD` vs `ENTRYPOINT`?** ENTRYPOINT = the fixed executable; CMD = default arguments (overridable). Use exec form.

**Q: Why does `depends_on` not guarantee readiness?** It only orders start. Use healthchecks (`condition: service_healthy`) or retry in the app.

**Q: L4 vs L7 load balancing?** L4 balances TCP connections without reading payloads (fast, protocol-agnostic). L7 reads HTTP: path/header routing, cookies, retries, auth, but costs more CPU.

**Q: How does HAProxy achieve high availability?** Active health checks remove bad backends; redundant HAProxy pair with VRRP floating IP; graceful reloads; connection draining.

**Q: Which algorithm for gRPC?** Because gRPC multiplexes requests on long-lived HTTP/2 connections, balance at L7 with HTTP/2 backend support (`proto h2`) or use client-side balancing; `leastconn` helps with uneven streams.

**Q: How do you do zero-downtime deploys behind HAProxy?** Start new instances, wait for health checks to pass, drain old (set to `drain` via runtime API), stop after in-flight requests finish (graceful shutdown).

### One more gotcha (seen live)
`offer-worker` exited with `connection refused` because Temporal wasn't accepting connections yet when it started. `depends_on` only orders *start*, not *readiness*. Fix: `restart: on-failure` (or a healthcheck + `depends_on: condition: service_healthy`, or retry in the app).
