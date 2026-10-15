import json
import os

from .types import Message, ToolCall

MODEL = os.environ.get("HEARTH_MODEL", "claude-sonnet-5-5")


class ScriptedLLM:
    """Deterministic fake: returns pre-written replies. Makes agent tests fast and free."""

    def __init__(self, replies):
        self.replies, self.seen = list(replies), []

    def complete(self, system, messages, tools):
        self.seen.append(list(messages))
        return self.replies.pop(0)


class AnthropicLLM:
    """Adapter to the Claude Messages API (needs `pip install anthropic` + ANTHROPIC_API_KEY)."""

    def __init__(self):
        import anthropic  # imported lazily so tests need no SDK

        self.client = anthropic.Anthropic()

    def complete(self, system, messages, tools):
        resp = self.client.messages.create(
            model=MODEL, max_tokens=1024, system=system, tools=tools,
            messages=[_to_api(m) for m in messages],
        )
        return _from_api(resp)


def _to_api(m):
    if m.role == "tool":
        block = {"type": "tool_result", "tool_use_id": m.tool_call_id, "content": m.content}
        return {"role": "user", "content": [block]}
    if m.tool_calls:
        blocks = [{"type": "tool_use", "id": c.id, "name": c.name, "input": c.args} for c in m.tool_calls]
        return {"role": "assistant", "content": blocks}
    return {"role": m.role, "content": m.content}


def _from_api(resp):
    text = "".join(b.text for b in resp.content if b.type == "text")
    calls = [ToolCall(b.id, b.name, b.input) for b in resp.content if b.type == "tool_use"]
    return Message("assistant", text, calls)
