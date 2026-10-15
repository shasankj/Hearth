# Java

## Core concepts
- **JVM:** compiled to bytecode, run by the JVM (JIT compiles hot code; "write once, run anywhere"). Memory: **heap** (young gen → old gen; objects), **stack** per thread (frames, primitives, references), **metaspace** (class metadata).
- **Garbage collectors:** Serial/Parallel (throughput), **G1** (default; region-based, pause targets), **ZGC/Shenandoah** (very low pause, large heaps). Tune with `-Xmx`, `-XX:+UseG1GC`; diagnose with GC logs, heap dumps, JFR.
- **OOP:** classes, interfaces (default methods), abstract classes, inheritance vs composition (prefer composition), polymorphism, encapsulation, `final`.
- **Modern Java (17/21):** **records** (immutable data carriers), **sealed classes**, pattern matching (`instanceof`, `switch`), text blocks, `var`, **virtual threads** (Java 21, Project Loom: millions of cheap threads for blocking I/O code).
- **Collections:** `List` (ArrayList vs LinkedList), `Map` (HashMap vs TreeMap vs LinkedHashMap vs ConcurrentHashMap), `Set`. **`equals`/`hashCode` contract**: equal objects must have equal hash codes or HashMap breaks.
- **Generics:** compile-time only (type erasure); wildcards `? extends T` (producer) / `? super T` (consumer): PECS.
- **Streams/Optional:** functional pipelines (`map/filter/collect`), lazy until terminal op; `Optional` for return values, not fields/params.
- **Exceptions:** checked (must handle/declare) vs unchecked (`RuntimeException`). `try-with-resources` for `AutoCloseable`.
- **Immutability** makes code thread-safe and simple (`record`, `List.copyOf`).

## Concurrency (senior topic)
- **Java Memory Model:** *happens-before* defines visibility. `volatile` = visibility + ordering (not atomicity). `synchronized` = mutual exclusion + visibility. `Atomic*` = lock-free CAS operations. `ReentrantLock` = explicit lock with `tryLock`, fairness, conditions.
- **Executors/thread pools** (`Executors.newFixedThreadPool`), `Future`, **`CompletableFuture`** (compose async steps: `thenApply`, `thenCombine`, `exceptionally`), `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue`, `CountDownLatch`, `Semaphore`.
- **Deadlock** conditions: mutual exclusion, hold-and-wait, no preemption, circular wait. Avoid by consistent lock ordering/timeouts.
- **Race condition:** check-then-act without atomicity (exactly our booking problem, below).
- **Virtual threads (21):** `Executors.newVirtualThreadPerTaskExecutor()`; don't pool them; avoid `synchronized` pinning for long blocking.

## Spring Boot essentials (likely asked; not used here to keep the build dependency-free)
- **IoC/DI:** the container creates and wires **beans** (`@Component/@Service/@Repository`, `@Configuration/@Bean`); prefer **constructor injection**. Scopes: singleton (default), prototype, request.
- **Auto-configuration** (`@SpringBootApplication` = `@Configuration + @EnableAutoConfiguration + @ComponentScan`) wires defaults from the classpath; override with properties/beans. **Starters** group dependencies.
- **Web:** `@RestController`, `@GetMapping`, `@RequestBody`, `@ControllerAdvice` + `@ExceptionHandler` for error mapping, validation with `@Valid`.
- **Data/JPA:** entities, repositories, **`@Transactional`** (proxy-based; self-invocation bypasses it; rollback on unchecked exceptions by default), **N+1 query problem** (fix with `JOIN FETCH`/entity graphs), lazy loading pitfalls, optimistic locking (`@Version`).
- **Actuator** (health, metrics), Micrometer → Datadog, profiles, config properties, testing (`@SpringBootTest`, `@WebMvcTest`, Testcontainers), JUnit 5 + Mockito.

## Code walkthrough ([services/inspection](../services/inspection/src/main/java/com/hearth/inspection))
- **[Tour.java](../services/inspection/src/main/java/com/hearth/inspection/Tour.java)**: a `record` with a compact constructor that validates (invalid objects can't exist).
- **[TourStore.java](../services/inspection/src/main/java/com/hearth/inspection/TourStore.java)**: the **port** (interface) the HTTP layer depends on. Two adapters implement it:
  - **[MemoryTourStore](../services/inspection/src/main/java/com/hearth/inspection/MemoryTourStore.java)**: `ConcurrentHashMap` + `synchronized` check-then-add (tests/local).
  - **[JdbcTourStore](../services/inspection/src/main/java/com/hearth/inspection/JdbcTourStore.java)**: `INSERT … ON CONFLICT (listing_id, date) DO NOTHING`; **0 rows inserted ⇒ already booked ⇒ `ConflictException` (409)**. SQLState `23503` (foreign key) ⇒ unknown listing ⇒ 404. The database constraint is the real guard: it holds across many service instances, which an in-JVM lock cannot. (Production: use a pool like HikariCP; this opens a connection per request.)
- **[App.java](../services/inspection/src/main/java/com/hearth/inspection/App.java)**: JDK `HttpServer` on a fixed thread pool; `statusFor(exception)` maps domain exceptions to 409/404/400/500 (500 bodies are generic, stack traces only in logs); rejects past dates; `storeFromEnv()` picks Postgres when `JDBC_URL` is set.
- **[InspectionTest.java](../services/inspection/src/test/java/com/hearth/inspection/InspectionTest.java)**: the **same contract test runs against both stores**; plus a 20-thread race (exactly one booking wins).
- **Dockerfile gotcha:** `ADD <url>` creates a root-only file; the runtime user (`nobody`) couldn't read the JDBC jar and got "No suitable driver". Fix: `chmod 0644`.

## Interview Q&A
**Q: `HashMap` vs `ConcurrentHashMap`?** HashMap isn't thread-safe (can corrupt/loop under concurrent writes). ConcurrentHashMap uses fine-grained locking/CAS per bin, allows concurrent reads/writes, no null keys/values, atomic ops like `computeIfAbsent`/`merge`.

**Q: `synchronized` vs `ReentrantLock`?** Both mutual exclusion; Reentrant adds `tryLock`, timed/interruptible acquisition, fairness, multiple conditions; must `unlock` in `finally`.

**Q: What does `volatile` do?** Guarantees visibility and prevents reordering around it; doesn't make `count++` atomic (use `AtomicInteger`).

**Q: String immutability?** Strings are immutable → safe to share, cache hash, intern; use `StringBuilder` for concatenation in loops.

**Q: `==` vs `equals`?** `==` compares references (or primitives), `equals` compares logical equality; override `hashCode` with it.

**Q: How does GC decide what to collect?** Reachability from GC roots (thread stacks, statics). Generational hypothesis: most objects die young → cheap young collections.

**Q: Checked vs unchecked exceptions?** Checked for recoverable conditions callers must handle; unchecked for programming errors/unrecoverable; many modern codebases favor unchecked.

**Q: How do you diagnose high CPU or memory in prod?** Thread dump (`jstack`) for hot/blocked threads, JFR/async-profiler for CPU, heap dump + MAT for leaks, GC logs, metrics (Micrometer).

**Q: Streams: pitfalls?** Don't mutate external state in lambdas; parallel streams share the common pool; they're lazy; avoid for tiny collections where loops are clearer.

**Q: Why records?** Immutable data class with auto `equals/hashCode/toString/accessors`: ideal for DTOs/value objects.
