# Apache Thrift

## Core concepts
Thrift = **IDL + code generator + RPC runtime**, created at Facebook (open sourced 2007, now an Apache project). Like gRPC/protobuf, you define types and services once, generate clients/servers for many languages.

Thrift is built from **layers you choose independently**:
| Layer | Options | Role |
|---|---|---|
| **Protocol** (serialization) | Binary, Compact (smaller, varint), JSON | How data is encoded |
| **Transport** | Socket, Buffered, **Framed**, HTTP, memory | How bytes move |
| **Processor** | generated | Dispatches an incoming call to your handler |
| **Server** | Simple (1 thread), ThreadPool, Threaded-selector, **Nonblocking** | Concurrency model |

Rule: client and server must agree on protocol **and** transport (e.g. Framed + Compact). A Nonblocking server requires Framed transport.

## IDL basics ([proto/thrift/pricing.thrift](../proto/thrift/pricing.thrift))
```thrift
struct PriceRequest { 1: required i64 listing_price, 2: required string city, 3: required i32 beds }
exception InvalidInput { 1: string message }
service PricingService { Estimate estimate(1: PriceRequest req) throws (1: InvalidInput bad) }
```
- **Field IDs** (`1:`) are the wire identity (like protobuf field numbers). Never reuse or renumber.
- `required` / `optional` / default. `required` is dangerous for evolution (can never be removed safely); prefer optional or default.
- Types: `bool, byte, i16, i32, i64, double, string, binary, list<T>, set<T>, map<K,V>`, structs, enums, unions, typedefs.
- **Exceptions are first-class**: declared in `throws`, travel over the wire as typed errors (gRPC has only status codes + details).
- Services can `extends` other services. `oneway` methods return nothing (fire and forget).

## Thrift vs gRPC (a favorite question)
| | Thrift | gRPC |
|---|---|---|
| Transport | Pluggable (raw TCP, framed, HTTP) | HTTP/2 only |
| Streaming | Not built in | Native (4 kinds) |
| Serialization | Binary / Compact / JSON | Protobuf |
| Ecosystem | Strong in older, polyglot backends (Facebook, Twitter/Finagle, Uber, Evernote, Compass-style stacks) | Cloud-native default, Kubernetes/mesh/Envoy friendly |
| Typed exceptions | Yes | Status codes + details |
| Deadlines/metadata | Manual / library dependent | Built in |
| Tooling/LB/observability | Less out of the box | Excellent |

Why a company may still have Thrift: it predates gRPC, is already deployed, and "if it works, migrate gradually" (put an adapter or gateway in between).

## Advanced
- **Evolution:** add new fields with new IDs as optional; old clients ignore unknown IDs. Don't change types.
- **Compact protocol** reduces size using zig-zag varints; **Framed** transport length-prefixes each message (needed for non-blocking servers).
- **Multiplexed services:** serve several services on one port with `TMultiplexedProcessor`.
- **Timeouts/retries/LB** are your job (or Finagle's); no built-in deadline propagation.
- **Security:** TLS on the socket; auth must be added at transport/application level.

## Code walkthrough
**[services/pricing/estimate.go](../services/pricing/estimate.go)**
- `handler` implements the generated `pricing.PricingService` interface. Methods take `context.Context` first (this generator version).
- `validate` returns `&pricing.InvalidInput{...}`: returning the generated exception type makes the client receive a *typed* exception (tested in `TestInvalidInputException`).
- `factorFor`, `bedBonus`, `confidence`: pure functions, each ≤10 lines.

**[services/pricing/main.go](../services/pricing/main.go)**: `newServer` shows the layers explicitly: `TServerSocket` (transport) + `TBufferedTransportFactory` + `TBinaryProtocolFactoryDefault` (protocol) + the generated `Processor` → `TSimpleServer`.

**[services/pricing/pricing_test.go](../services/pricing/pricing_test.go)**: starts the real server on a free port, connects a real client, calls `Estimate` across a TCP socket.

### Problems I hit and fixed (use as an interview story)
1. The generator inside the Docker image and the Go library **must be the same version**. First try: compiler `1.0.0-dev` + lib v0.13 → compile errors (`Flush` needed a `context`). Fix: use the `thrift:0.12.0` image and `github.com/apache/thrift v0.12.0`.
2. Generated code imported an old `git.apache.org` path → fixed with generator option `thrift_import=github.com/apache/thrift/lib/go/thrift`.
3. Test hung at cleanup: `TSimpleServer.Stop()` waits for open client connections. Close the client first (`t.Cleanup` runs LIFO).

Generate with (no local compiler needed):
```bash
docker run --rm -v "$PWD":/work -w /work thrift:0.12.0 thrift -r \
  --gen go:package_prefix=github.com/you/hearth/gen/thrift/,thrift_import=github.com/apache/thrift/lib/go/thrift \
  -out gen/thrift proto/thrift/pricing.thrift
```

## Interview Q&A
**Q: What is Thrift?** An IDL-based cross-language RPC and serialization framework with pluggable protocols/transports/servers.

**Q: Binary vs Compact vs JSON protocol?** Binary is simple and fast; Compact is smaller (varints/zig-zag); JSON is debuggable and interoperable but larger/slower.

**Q: Why Framed transport?** Prefix each message with its length so non-blocking servers can read complete messages without blocking; mandatory for `TNonblockingServer`.

**Q: How do you evolve a Thrift schema safely?** Only add fields with new IDs, keep them optional, never reuse IDs, avoid `required`, don't change types.

**Q: Thrift or gRPC for new work?** gRPC by default (HTTP/2, streaming, deadlines, ecosystem). Keep Thrift where it's established; migrate incrementally behind an adapter or gateway.

**Q: How are errors handled?** Declared exceptions in the IDL are typed and thrown across the wire; unexpected failures arrive as `TApplicationException`. Transport failures surface as `TTransportException`.

**Q: How would you make a Thrift client resilient?** Connection pooling, timeouts on socket, retry only idempotent calls with backoff + jitter, circuit breaker, and health checks (or Finagle for that).
