from dataclasses import dataclass, field


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict


@dataclass
class Message:
    role: str  # "user" | "assistant" | "tool"
    content: str = ""
    tool_calls: list = field(default_factory=list)  # assistant asks to run tools
    tool_call_id: str = ""  # tool result answers this call
