# gRPC and Protocol Buffers

## Core concepts
- **Protobuf** = a schema language + compact binary encoding. You write `.proto`, generate code per language (`protoc`). Typically 3-10x smaller/faster than JSON.
- **gRPC** = RPC framework over **HTTP/2** using protobuf by default. Calls look like local method calls; the generated client is a "stub".
- **Four call types:** unary (1 request → 1 response), server streaming, client streaming, bidirectional streaming. This repo uses unary (`GetListing`, `SearchListings`) and server streaming (`StreamListings`).
- **Why HTTP/2:** multiplexed streams on one connection, header compression (HPACK), binary framing, flow control, server push of data via streaming.
- **Field numbers** (`string id = 1;`) are the wire identity, not the names.
- **Status codes** (not HTTP codes): `OK, NOT_FOUND(5), INVALID_ARGUMENT(3), DEADLINE_EXCEEDED(4), UNAVAILABLE(14), UNAUTHENTICATED(16), PERMISSION_DENIED(7), INTERNAL(13)...`
- **Metadata** = headers (auth tokens, request ids). **Deadlines** = absolute time budget propagated downstream.

## Wire format (shows depth)
Each field is encoded as `(field_number << 3 | wire_type)` followed by the value. Integers use **varints** (small numbers = fewer bytes). Strings are length-prefixed. Unknown fields are preserved/ignored, which is what makes evolution safe.

## Schema evolution rules (very commonly asked)
- **Never change or reuse a field number.** Mark removed ones `reserved 4;`.
- Adding new fields is safe (old readers ignore them; new readers see defaults from old writers).
- Don't change a field's type incompatibly. Proto3 has no `required` (by design: it breaks compatibility); validate in code.
- Defaults: missing scalar = zero value, so you can't distinguish "0" from "unset" unless you use `optional` or wrapper types.

## Advanced
- **Deadlines vs timeouts:** a deadline propagates across hops (`context` in Go, `deadline` in grpc-js); every service stops working when it expires. Always set one on the client.
- **Interceptors** = middleware (auth, logging, metrics, tracing, retries).
- **Load balancing:** gRPC keeps one long-lived HTTP/2 connection, so an L4 balancer or a plain Kubernetes `ClusterIP` Service balances *connections*, not *requests* (one pod gets everything). Options: **client-side balancing** (DNS headless Service + `round_robin`, what this repo does), an **L7 proxy** (Envoy/Linkerd/Istio), or a lookaside LB (xDS).
- **Retries/hedging** via service config; only retry idempotent calls. **Keepalive** pings detect dead connections.
- **Security:** TLS or mTLS; per-RPC credentials (JWT). **Reflection** lets `grpcurl` discover services (disable or protect in prod).
- **Health checking protocol** (`grpc.health.v1`) is what Kubernetes `grpc:` probes call.
- **gRPC-Web / gateway:** browsers can't speak raw gRPC, so use gRPC-Web proxy or grpc-gateway (REST ↔ gRPC). That's why our browser talks REST to Koa, and Koa talks gRPC to Go (a **BFF**).
- **Errors:** return a `status` (code + message + optional rich details). Don't leak internals: `toStatus` returns generic "internal error" for unknown errors.

## Code walkthrough
**[proto/listing/v2/listing.proto](../proto/listing/v2/listing.proto)**: the package is versioned. We moved `v1 → v2` because the `Listing` message changed incompatibly (many new fields and types), the exact policy described above. Messages: `Listing`, `Agent`, `PricePoint`, `SearchRequest` (filters, bounds, paging), `SearchResponse` (with `total`), `CityStat`. RPCs: `GetListing`, `GetListings` (batch), `SearchListings`, `SimilarListings`, `MarketStats`, `StreamListings`. Generate with:
```bash
protoc --go_out=. --go_opt=module=github.com/you/hearth \
       --go-grpc_out=. --go-grpc_opt=module=github.com/you/hearth proto/listing/v2/listing.proto
```
Generated files in `gen/listingv2/` (don't edit): message structs and the `ListingServiceServer`/`Client` interfaces.

**Server** ([services/listing/server.go](../services/listing/server.go)): implements the generated interface, validates (`INVALID_ARGUMENT`), returns `NOT_FOUND`, hides internals behind `INTERNAL`.

**Client** ([services/api/src/grpcClient.js](../services/api/src/grpcClient.js)):
- `protoLoader.loadSync(PROTO, {longs: Number, defaults: true})` loads the `.proto` at runtime (no codegen in Node). `longs: Number` because int64 would otherwise arrive as strings.
- `call()` wraps the callback API in a Promise and attaches `{ deadline }` to **every** call (2s).
- `CHANNEL` sets `round_robin` so a headless Kubernetes Service spreads requests across pods. **Proof from the real run:** requests split 4 / 2 between the two listing pods (before the fix: all to one).

**Error mapping** ([errorHandler.js](../services/api/src/middleware/errorHandler.js)): gRPC `NOT_FOUND`→HTTP 404, `DEADLINE_EXCEEDED`→504, `UNAVAILABLE`→503.

## Interview Q&A
**Q: gRPC vs REST?** gRPC: binary, typed contracts, streaming, codegen, great for internal service-to-service. REST/JSON: human-readable, browser-native, cacheable via HTTP semantics, great for public APIs. Typical: REST at the edge, gRPC inside.

**Q: Why not just use gRPC from the browser?** Browsers can't control HTTP/2 framing/trailers; need gRPC-Web + proxy. We use a BFF.

**Q: How do you version a gRPC API?** Additive changes in place; breaking changes → new package `v2`. Never reuse field numbers; use `reserved`.

**Q: What happens if the server is slow?** Client deadline fires → `DEADLINE_EXCEEDED`; the cancellation propagates so the server stops wasted work. Combine with retries (idempotent only) and circuit breakers.

**Q: Why does one pod get all traffic behind a Kubernetes Service?** One persistent HTTP/2 connection = one kube-proxy decision. Use client-side LB, a mesh, or an L7 proxy.

**Q: Streaming use cases?** Server streaming for large result sets/progress/feeds; client streaming for uploads/telemetry batching; bidi for chat/real-time. Handle backpressure (HTTP/2 flow control) and cancellation.

**Q: How do you secure it?** mTLS between services (mesh or cert-manager), JWT in metadata at the edge, authorization interceptors, least-privilege network policies.

**Q: How do you test gRPC?** In-process with `bufconn` (see `listing_test.go`), `grpcurl` for manual calls, contract tests by sharing the `.proto`, `buf breaking` in CI to catch incompatible changes.

**Q: Protobuf vs JSON downsides?** Not human-readable, need schema/tooling; but smaller, faster, and strongly typed.
