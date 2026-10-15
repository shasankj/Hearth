"""Daily ETL: Postgres listings -> city stats -> analytics.city_stats (warehouse)."""
import pendulum
from airflow.sdk import dag, task

from etl_logic import city_stats, validate

DB = {"host": "postgres", "dbname": "hearth", "user": "hearth", "password": "hearth"}
UPSERT = """INSERT INTO analytics.city_stats (day, city, listings, avg_price_usd)
VALUES (%s, %s, %s, %s)
ON CONFLICT (day, city) DO UPDATE SET listings = EXCLUDED.listings, avg_price_usd = EXCLUDED.avg_price_usd"""


def _connect():
    import psycopg2
    return psycopg2.connect(**DB)


@task(retries=2)
def extract():
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT city, price_usd FROM listings")
        return [{"city": c, "price_usd": p} for c, p in cur.fetchall()]


@task
def transform(rows):
    return city_stats(validate(rows))


@task
def load(stats, ds=None):
    with _connect() as conn, conn.cursor() as cur:
        for city, s in stats.items():
            cur.execute(UPSERT, (ds, city, s["listings"], s["avg_price_usd"]))


@dag(schedule="@daily", start_date=pendulum.datetime(2026, 1, 1, tz="UTC"), catchup=False, tags=["hearth"])
def listings_daily():
    load(transform(extract()))


listings_daily()
