from .types import Message

SYSTEM = (
    "You are Hearth's listing assistant. Use tools to find real listings. "
    "Never invent listings or prices. If tools return nothing, say so."
)


class Agent:
    """The agent loop: think -> (call tools -> observe)* -> answer, bounded by max_steps."""

    def __init__(self, llm, registry, max_steps=5):
        self.llm, self.registry, self.max_steps = llm, registry, max_steps

    def run(self, question):
        msgs = [Message("user", question)]
        for _ in range(self.max_steps):
            reply = self.llm.complete(SYSTEM, msgs, self.registry.schemas())
            msgs.append(reply)
            if not reply.tool_calls:
                return reply.content
            msgs.extend(self._observe(reply.tool_calls))
        return "I could not finish within the step limit."

    def _observe(self, calls):
        return [Message("tool", self.registry.execute(c), tool_call_id=c.id) for c in calls]
