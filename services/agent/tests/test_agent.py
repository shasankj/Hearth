import json
import unittest

from hearth_agent.agent import Agent
from hearth_agent.llm import ScriptedLLM
from hearth_agent.registry import ToolRegistry
from hearth_agent.types import Message, ToolCall


class FakeApi:
    def search(self, city="", max_price=0, min_beds=0):
        return [{"id": "L1", "city": city, "beds": 3}]

    def get(self, listing_id):
        raise RuntimeError("boom")


def tool_reply(name, args, call_id="c1"):
    return Message("assistant", "", [ToolCall(call_id, name, args)])


class AgentTest(unittest.TestCase):
    def test_tool_result_reaches_model_then_answers(self):
        llm = ScriptedLLM([tool_reply("search_listings", {"city": "Boston"}), Message("assistant", "Found L1")])
        out = Agent(llm, ToolRegistry(FakeApi())).run("homes in Boston?")
        self.assertEqual(out, "Found L1")
        tool_msg = llm.seen[1][-1]  # what the model saw on its 2nd turn
        self.assertEqual(tool_msg.role, "tool")
        self.assertEqual(json.loads(tool_msg.content)[0]["id"], "L1")

    def test_unknown_tool_is_rejected_not_executed(self):
        out = ToolRegistry(FakeApi()).execute(ToolCall("x", "drop_database", {}))
        self.assertIn("unknown tool", out)

    def test_tool_exception_becomes_observation(self):
        out = ToolRegistry(FakeApi()).execute(ToolCall("x", "get_listing", {"id": "L1"}))
        self.assertTrue(out.startswith("error:"))

    def test_step_limit_stops_infinite_loop(self):
        loop = [tool_reply("search_listings", {}) for _ in range(10)]
        out = Agent(ScriptedLLM(loop), ToolRegistry(FakeApi()), max_steps=3).run("?")
        self.assertIn("step limit", out)


if __name__ == "__main__":
    unittest.main()
