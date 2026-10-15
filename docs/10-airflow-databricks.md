# Airflow and Databricks

## Apache Airflow core
- **Workflow orchestrator for batch data pipelines**, defined as Python code. A pipeline is a **DAG** (directed acyclic graph) of **tasks** with dependencies. It *schedules and monitors*, it is **not** a data-processing engine.
- **Components:** **Scheduler** (decides what runs when, creates task instances), **Executor** (how tasks run: Local, Celery, **Kubernetes**), **Workers**, **Metadata DB** (state), **Web UI/API server**, DAG processor (parses DAG files). Airflow 3 adds the `airflow.sdk` authoring interface, a split API server, DAG versioning and event-driven scheduling (assets).
- **Operators** (do work: `BashOperator`, `PostgresOperator`...), **Sensors** (wait for a condition), **Hooks** (connections to external systems), **Connections/Variables** (config/secrets; use a secrets backend).
- **TaskFlow API:** `@task` decorated Python functions; return values pass between tasks via **XCom** (small metadata only, **not** big data: pass S3 paths, not DataFrames).
- **Schedule & time:** `schedule="@daily"`, **logical date** (`ds`) = the data interval being processed, not "now". `catchup` controls backfilling missed intervals. **Backfill** reruns past intervals.
- **Reliability:** `retries`, `retry_delay`, `execution_timeout`, `sla`/deadline alerts, `trigger_rule` (`all_done`, `one_failed`), **pools** (limit concurrency per resource), `max_active_runs`.
- **Idempotency (key principle):** rerunning a task for the same interval must give the same result. Use **upserts / overwrite partitions** (`ON CONFLICT DO UPDATE`), never blind appends; deterministic outputs keyed by `ds`.
- **Dynamic task mapping** (`.expand()`) fans out over runtime data. **Branching** (`@task.branch`). **Task groups** for UI organization.
- **Anti-patterns:** heavy processing inside Airflow workers, top-level code in DAG files that does I/O (parsed every ~30 s), big XComs, non-idempotent tasks, depending on "now".

## Our DAG ([airflow/dags](../airflow/dags))
**[etl_logic.py](../airflow/dags/etl_logic.py)**: pure functions (`group_by_city`, `summarize`, `city_stats`, `validate`) with **no Airflow imports** → unit-tested with plain `unittest` (2 tests passing, [tests/test_etl_logic.py](../airflow/tests/test_etl_logic.py)). *Design lesson: keep business logic out of the DAG file.*

**[listings_daily.py](../airflow/dags/listings_daily.py)**: three TaskFlow tasks and the wiring:
- `extract` (`retries=2`): reads `city, price_usd` from Postgres `listings`.
- `transform`: `validate` (reject non-positive prices → task fails visibly) then `city_stats`.
- `load`: upserts into `analytics.city_stats` using `ON CONFLICT (day, city) DO UPDATE` → **idempotent** per day (`ds` is the logical date).
- `@dag(schedule="@daily", catchup=False)` and `load(transform(extract()))` defines `extract >> transform >> load`.
- DB imports (`psycopg2`) are **inside** tasks so DAG parsing stays fast.

Verification status: logic unit-tested, and the DAG was **parsed by real Airflow 3.0.6** in Docker (no import errors; tasks `extract`, `transform`, `load` with edges `extract → transform → load`). It was *not* scheduled on a running Airflow cluster. Gotcha: `etl_logic` is importable only when the `dags` folder is on `PYTHONPATH` (Airflow's scheduler does this; my ad-hoc check had to set it).

To run Airflow for real (free): `docker compose` file from the official docs (`airflow.apache.org` → "Running Airflow in Docker"), mount `airflow/dags`, add a Postgres connection pointing at the `postgres` service.

## Databricks (theory + code sketch; not run)
- **Lakehouse platform** on cloud object storage (S3) combining data-lake flexibility with warehouse reliability. Built by the creators of **Apache Spark**.
- **Spark architecture:** **driver** (plans, schedules) + **executors** (run tasks on partitions). **Lazy evaluation:** transformations (`filter`, `select`, `groupBy`) build a plan; **actions** (`count`, `write`) trigger execution. **Narrow** transforms (no shuffle) vs **wide** (shuffle across the network: `groupBy`, `join`) = the expensive ones. **Catalyst** optimizer and **Tungsten** engine; **AQE** (adaptive query execution) fixes skew and partition counts at runtime. **Photon** = vectorized C++ engine.
- **Delta Lake:** open table format on Parquet + a **transaction log** (`_delta_log`) → ACID transactions, **time travel**, schema enforcement/evolution, `MERGE` upserts, `OPTIMIZE`/`ZORDER` (file compaction + data skipping), `VACUUM`.
- **Medallion architecture:** **Bronze** (raw), **Silver** (cleaned/conformed), **Gold** (business aggregates).
- **Unity Catalog:** centralized governance (catalog.schema.table, permissions, lineage). **Jobs/Workflows** schedule notebooks/pipelines; **Delta Live Tables / Lakeflow** declarative pipelines; **Auto Loader** incremental file ingestion; **Structured Streaming** for streams; **Databricks SQL** warehouses for BI.
- **Free access:** Databricks **Free Edition** (sign up) for learning.

```python
# PySpark sketch: the same city stats as our Airflow transform, at scale
from pyspark.sql import functions as F
df = spark.read.table("bronze.listings")
gold = (df.filter(F.col("price_usd") > 0)
          .groupBy("city")
          .agg(F.count("*").alias("listings"), F.avg("price_usd").cast("long").alias("avg_price_usd")))
gold.write.format("delta").mode("overwrite").saveAsTable("gold.city_stats")
```

## Airflow + Databricks together
Airflow orchestrates (schedule, dependencies, retries, alerts), Databricks computes (heavy Spark). Use `DatabricksRunNowOperator`/`DatabricksSubmitRunOperator`; Airflow stays light. Alternative: Databricks Workflows alone if everything lives there.

## Interview Q&A
**Q: What does Airflow do and not do?** Orchestrates when/in what order tasks run, retries, alerts, history. It doesn't process big data itself; delegate to Spark/warehouse.

**Q: How do you make a DAG idempotent?** Parameterize by logical date; overwrite/upsert the partition for that date; no `now()`; deterministic output paths; safe to rerun and backfill.

**Q: XCom limits?** Small serializable values stored in the metadata DB; pass references (S3 keys) not data.

**Q: `catchup` and `backfill`?** `catchup=True` creates runs for every missed interval since `start_date`; backfill manually reruns historic intervals. Dangerous without idempotent tasks.

**Q: Why is DAG-file top-level code a problem?** The DAG processor re-imports files every few seconds; slow/side-effecting code slows scheduling.

**Q: Executors?** Local (dev), Celery (static worker pool + broker), Kubernetes (pod per task; isolation and autoscaling).

**Q: Spark shuffle?** Redistributing data across partitions over the network for wide transformations; minimize by filtering early, broadcast joins for small tables, proper partitioning, AQE.

**Q: Delta Lake vs plain Parquet?** Delta adds ACID, schema enforcement, time travel, upserts, and efficient metadata via a transaction log.

**Q: Data warehouse vs data lake vs lakehouse?** Warehouse = structured, schema-on-write, fast SQL; lake = cheap raw files, schema-on-read, weak governance; lakehouse = lake storage with warehouse features (ACID, governance, SQL) via open table formats (Delta/Iceberg).

**Q: Batch vs streaming?** Batch processes bounded data on a schedule (Airflow DAG); streaming processes unbounded data continuously (Kafka + Spark Structured Streaming/Flink). Choose by latency need.
