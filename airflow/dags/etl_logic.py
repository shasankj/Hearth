"""Pure functions for the ETL. No Airflow imports => trivially unit-testable."""
from collections import defaultdict


def group_by_city(rows):
    groups = defaultdict(list)
    for row in rows:
        groups[row["city"]].append(row["price_usd"])
    return groups


def summarize(prices):
    return {"listings": len(prices), "avg_price_usd": sum(prices) // len(prices)}


def city_stats(rows):
    return {city: summarize(p) for city, p in group_by_city(rows).items()}


def validate(rows):
    bad = [r for r in rows if r["price_usd"] <= 0]
    if bad:
        raise ValueError(f"{len(bad)} listings have non-positive price")
    return rows
