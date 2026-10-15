import sys

from .agent import Agent
from .llm import AnthropicLLM
from .registry import ToolRegistry
from .tools import ApiClient


def main():
    question = " ".join(sys.argv[1:]) or "Find me a 2+ bedroom home in Boston"
    agent = Agent(AnthropicLLM(), ToolRegistry(ApiClient()))
    print(agent.run(question))


if __name__ == "__main__":
    main()
