import sys
import unittest

sys.path.insert(0, "airflow/dags")
from etl_logic import city_stats, validate  # noqa: E402

ROWS = [
    {"city": "Boston", "price_usd": 800},
    {"city": "Boston", "price_usd": 400},
    {"city": "Austin", "price_usd": 600},
]


class EtlTest(unittest.TestCase):
    def test_city_stats(self):
        self.assertEqual(city_stats(ROWS)["Boston"], {"listings": 2, "avg_price_usd": 600})

    def test_validate_rejects_bad_price(self):
        with self.assertRaises(ValueError):
            validate([{"city": "X", "price_usd": 0}])


if __name__ == "__main__":
    unittest.main()
