# Postgres, TablePlus and Redshift

## Postgres core
- **ACID:** Atomicity (all-or-nothing), Consistency (constraints hold), Isolation (concurrent transactions don't interfere), Durability (WAL fsync → survives crash).
- **MVCC:** readers don't block writers. Each row version has `xmin/xmax`; updates create **new row versions**; old ones are cleaned by **VACUUM** (autovacuum). Bloat + long-running transactions = performance problems.
- **Isolation levels:** Read Committed (default; each statement sees committed data), **Repeatable Read** (snapshot per transaction; Postgres prevents phantoms too), **Serializable** (SSI; may abort with serialization failure → retry). Anomalies: dirty read, non-repeatable read, phantom, write skew.
- **Indexes:** **B-tree** (default; `=`, ranges, ORDER BY), **GIN** (arrays, JSONB, full-text), GiST (geo, ranges), BRIN (huge ordered tables), Hash. **Composite index** column order matters (leftmost prefix). **Partial** (`WHERE status='open'`), **covering** (`INCLUDE`), expression indexes. Indexes speed reads, cost writes + space.
- **`EXPLAIN (ANALYZE, BUFFERS)`**: look for `Seq Scan` on big tables, row-estimate vs actual mismatch (stale stats → `ANALYZE`), `Nested Loop` blowups, sorts spilling to disk.
- **Constraints:** PK, FK, UNIQUE, CHECK, NOT NULL. Use them: the database is the last line of defense.
- **Locks & deadlocks:** row locks on UPDATE/`SELECT ... FOR UPDATE` (`SKIP LOCKED` for job queues), advisory locks. Avoid deadlocks via consistent ordering; keep transactions short.
- **Connection pooling:** each connection is a process (expensive). Use **PgBouncer** / app pools; size pools small (cores×2-ish).
- **Scaling:** read replicas (async, replication lag!), partitioning (range/list/hash), sharding (Citus), caching (Redis), CDC (logical replication / Debezium) to feed search and warehouse.
- **JSONB** for semi-structured data (indexable with GIN), but model core fields relationally.
- **Migrations:** backwards-compatible (expand → migrate → contract); add columns nullable; create indexes `CONCURRENTLY`.

## Our schema ([infra/postgres/001_schema.sql](../infra/postgres/001_schema.sql))
`users`, `agents`, `listings`, `price_history`, `favorites`, `saved_searches`, `inquiries`, `tours`, `offers`, and an `analytics` schema for the warehouse layer.
- **Full-text search:** `listings.tsv` is a **generated column** (`GENERATED ALWAYS AS (to_tsvector(...)) STORED`) with a **GIN** index; the query combines `websearch_to_tsquery` with `ILIKE` for partial words.
- **Arrays:** `features TEXT[]` with GIN; "has all of these features" is `features @> ARRAY['pool','garage']`.
- **Constraints as the last line of defense:** `CHECK` for enums and positive prices, FKs with deliberate `ON DELETE` rules, `UNIQUE (listing_id, date)` on `tours` (double-booking guard enforced by the database).
- **Money** is `BIGINT` (never float); rent listings store the monthly rent in the same column.
- **Derived data:** "price drop" is computed from `price_history` by a correlated subquery rather than stored.
- **Indexes:** `(status, city, price_usd)` serves the most common filter; `(lat, lng)` for map bounds; GIN for features and text.
- **Seed:** [gen_seed.py](../infra/postgres/gen_seed.py) deterministically generates 64 fictional listings, 8 agents and price histories. Schema + seed run once when the Docker volume is created (`docker compose down -v` to reset).
- **RDS:** point `DATABASE_URL` at RDS (`sslmode=require`) and run the two SQL files; see the README section "Using AWS RDS" and the Terraform module `terraform/modules/rds`.

## TablePlus (client)
GUI for Postgres/MySQL/Redshift/etc. Connect: host `localhost`, port `5432`, user/pass/db all `hearth` (see `docker-compose.yml`). Use it to browse tables, run SQL, view `EXPLAIN`, edit rows, compare schemas, export. Know that it's a *client only*; it adds no server features. Safer practices: read-only users for prod, color-code connections, require commit on edits.

## OLTP vs OLAP (setup for Redshift)
**OLTP** (Postgres): many small transactions, row-oriented, normalized, low latency. **OLAP** (warehouse): few huge scans/aggregations, **column-oriented**, denormalized (star schema: fact + dimensions), batch loads.

## Amazon Redshift (theory; not run: paid)
- **Architecture:** a **leader node** parses/plans queries and coordinates; **compute nodes** hold data in **slices**; **MPP** (massively parallel processing): each slice scans its share in parallel. **RA3** nodes separate compute from managed storage (S3-backed with local SSD cache); **Serverless** auto-scales RPUs.
- **Columnar storage + compression (encodings) + zone maps:** reads only needed columns/blocks → big scan savings.
- **Distribution style** (how rows spread across slices): `KEY` (co-locate join keys → avoids shuffle), `ALL` (copy small dimension table to every node), `EVEN` (round robin), `AUTO` (Redshift picks). Bad distribution = data skew + network shuffles.
- **Sort key:** physical ordering; speeds range filters (e.g. `sale_date`). Compound vs interleaved. **VACUUM** re-sorts and reclaims, **ANALYZE** updates stats (partly automatic now).
- **Loading:** use **`COPY` from S3** (parallel, compressed, many files ≈ number of slices) rather than row-by-row `INSERT`. **UNLOAD** to S3. **Redshift Spectrum** queries data in S3 directly; **materialized views**, **data sharing**, **federated queries**.
- **WLM / concurrency scaling** manage queues and bursts. Constraints (PK/FK) are **informational only** (not enforced!). Based on PostgreSQL 8.0 syntax with differences (no indexes, limited types).
- **Redshift vs Postgres:** Redshift for analytics over billions of rows; Postgres for OLTP. **vs Snowflake/BigQuery/Databricks:** similar warehouse roles; Redshift is AWS-native and tightly integrated with S3/Glue/IAM.

```sql
-- Redshift example
CREATE TABLE fact_sales (sale_id BIGINT, listing_id BIGINT, city VARCHAR(50), price BIGINT, sold_at DATE)
DISTKEY(listing_id) SORTKEY(sold_at);
COPY fact_sales FROM 's3://hearth-datalake/sales/' IAM_ROLE 'arn:aws:iam::123456789012:role/redshift-copy' FORMAT AS PARQUET;
```

## Interview Q&A
**Q: How would you speed up a slow query?** `EXPLAIN ANALYZE`; check missing/unused indexes, stale stats, selectivity, join order, `SELECT *`, N+1 from the app, pagination method; fix with the right (composite/partial) index, rewrite, caching, or denormalization.

**Q: Explain isolation levels with an example.** Two transactions book the same inspection slot: at Read Committed both may pass the check (write skew/lost update) → use unique constraint, `SELECT ... FOR UPDATE`, or Serializable with retry.

**Q: Why composite index `(city, price)` not `(price, city)`?** Equality on `city` first, then range on `price` uses the whole index; reversed order can't use `city` efficiently with a range first.

**Q: What is MVCC and what's its cost?** Versioned rows give lock-free reads; cost = dead tuples/bloat and need for vacuum.

**Q: Redshift distribution key choice?** Pick the most-joined large column with high cardinality and even distribution; small dims → `ALL`; unsure → `AUTO`.

**Q: How do you load data into Redshift?** `COPY` from S3 in compressed, split files via IAM role; stage → merge for upserts.

**Q: How do you keep search and warehouse in sync with Postgres?** CDC (logical decoding/Debezium → Kafka → sink) or batch ETL (our Airflow DAG).

**Q: Normalization vs denormalization?** Normalize OLTP for integrity; denormalize analytics (star schema) for scan speed.
