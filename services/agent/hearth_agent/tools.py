import json
import urllib.parse
import urllib.request


class ApiClient:
    """Thin HTTP client for the Koa BFF. The agent never talks to gRPC directly."""

    def __init__(self, base="http://localhost:3000", timeout=3):
        self.base, self.timeout = base, timeout

    def _get(self, path, params=None):
        qs = "?" + urllib.parse.urlencode(params) if params else ""
        with urllib.request.urlopen(self.base + path + qs, timeout=self.timeout) as r:
            return json.load(r)

    def search(self, city="", max_price=0, min_beds=0):
        params = {"city": city, "maxPrice": max_price, "minBeds": min_beds}
        return self._get("/api/listings", params)["listings"]

    def get(self, listing_id):
        return self._get(f"/api/listings/{urllib.parse.quote(listing_id)}")


SCHEMAS = [
    {
        "name": "search_listings",
        "description": "Search homes by city, max price (USD) and minimum bedrooms.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "max_price": {"type": "integer"},
                "min_beds": {"type": "integer"},
            },
        },
    },
    {
        "name": "get_listing",
        "description": "Get one listing by id.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
]
