import json

from .tools import SCHEMAS


class ToolRegistry:
    """Allow-list of tools the model may call. Anything else is rejected (guardrail)."""

    def __init__(self, api):
        self.api = api
        self._fns = {"search_listings": self._search, "get_listing": self._get}

    def schemas(self):
        return SCHEMAS

    def _search(self, args):
        return self.api.search(args.get("city", ""), args.get("max_price", 0), args.get("min_beds", 0))

    def _get(self, args):
        return self.api.get(args["id"])

    def execute(self, call):
        """Run a tool; ALWAYS return a string. Errors go back to the model so it can recover."""
        fn = self._fns.get(call.name)
        if fn is None:
            return f"error: unknown tool {call.name!r}"
        try:
            return json.dumps(fn(call.args))
        except Exception as exc:  # tool failures must not crash the loop
            return f"error: {exc}"
