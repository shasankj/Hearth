# Python and Agentic AI

## What an "agent" is
An LLM can only produce text. An **agent** wraps it in a **loop** that lets it **call tools** (functions/APIs), **observe** results, and decide the next step until it can answer:

```
user question → LLM → (wants tool?) ─yes→ run tool → append result → LLM → ... 
                          └─no→ final answer
```
Bound the loop with `max_steps`, validate tool calls, and keep a trace.

## Core concepts
- **Tool/function calling:** you describe tools with a JSON schema (`name`, `description`, `input_schema`). The model returns structured tool-use requests instead of prose. *You* execute them; the model never runs code itself.
- **Messages protocol (Claude Messages API):** assistant messages contain `tool_use` blocks (`id`, `name`, `input`); you reply with a user message containing `tool_result` blocks referencing `tool_use_id`. This is exactly what [llm.py](../services/agent/hearth_agent/llm.py) `_to_api` / `_from_api` translate.
- **System prompt** sets role and rules ("never invent listings"). **Temperature** controls randomness (low for tools/extraction).
- **Context window:** all messages count; long loops need trimming/summarization. **Prompt caching** reduces cost/latency for large repeated prefixes (system prompt, tool definitions).
- **Grounding & RAG:** retrieve relevant documents (vector search over embeddings + keyword), inject into the prompt, cite sources. Tool-based retrieval (our `search_listings`) is "agentic RAG".
- **Structured output:** ask for JSON matching a schema and validate (Pydantic); retry on invalid output.
- **MCP (Model Context Protocol):** open standard for exposing tools/resources/prompts to any LLM app; a tool server written once works with many clients.
- **Multi-agent patterns:** orchestrator-workers, routing, parallelization, evaluator-optimizer. Start with the simplest thing that works (a single loop with good tools) and add complexity only when evals show need.

## Advanced / production concerns
- **Guardrails:** tool **allow-list** (unknown tool rejected), argument validation, least-privilege credentials, read-only tools by default, human approval for risky actions (sending offers, payments), max steps/tokens/time/cost budgets.
- **Prompt injection:** content returned by tools (listing descriptions, web pages) can contain instructions. Treat tool output as **untrusted data**, never as instructions; don't give the agent tools + secrets it doesn't need; separate privileges; sanitize/flag; confirm sensitive actions.
- **Failure handling:** tool errors become observations (`error: ...`) so the model can retry or explain; timeouts on tools; idempotent tools; fallbacks.
- **Evals:** the most important practice. Build a dataset of questions + expected tool calls/answers; score with code checks and LLM-as-judge; track regressions per prompt/model change; test the loop with a **scripted fake LLM** (what we do) for determinism.
- **Observability:** log every step: messages, tool name+args, latency, tokens, cost; use traces (Datadog LLM Observability / OpenTelemetry).
- **Latency/cost:** smaller model for routing, bigger for reasoning; parallel tool calls; streaming tokens; cache.
- **Hallucination reduction:** ground in tools, require citations/ids, instruct to say "I don't know", verify claims against tool results.
- **Model ids** (current): `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`; this repo defaults to `claude-sonnet-5-5` via `HEARTH_MODEL`.

## Code walkthrough ([services/agent/hearth_agent](../services/agent/hearth_agent))
- **[types.py](../services/agent/hearth_agent/types.py)**: two dataclasses, `ToolCall` and `Message`. A provider-neutral message format so the agent core doesn't depend on any SDK.
- **[agent.py](../services/agent/hearth_agent/agent.py)**: `Agent.run` is the loop in 8 lines: call LLM → append reply → if no tool calls return text → else `_observe` (execute tools, append `tool` messages). Falls out with a message if `max_steps` is hit (guards against infinite loops).
- **[registry.py](../services/agent/hearth_agent/registry.py)**: `ToolRegistry.execute` looks the name up in an **allow-list dict**; unknown name → error string; exceptions → `"error: ..."` string. It *always returns a string* so the loop never crashes.
- **[tools.py](../services/agent/hearth_agent/tools.py)**: `ApiClient` calls the Koa REST API with `urllib` (stdlib, timeout 3 s); `SCHEMAS` are the tool descriptions the model sees. Note the agent talks to the *public* REST API, not the database: same permissions as any client.
- **[llm.py](../services/agent/hearth_agent/llm.py)**: `ScriptedLLM` (deterministic fake for tests) and `AnthropicLLM` (real adapter, SDK imported lazily). **The real adapter was not run live (no API key); the loop and registry were tested.**
- **Dependency injection** (`Agent(llm, registry)`) means swapping providers or faking is trivial.

### Tests ([tests/test_agent.py](../services/agent/tests/test_agent.py)), all 4 passing
1. Tool result reaches the model on the 2nd turn, and the final answer is returned.
2. Unknown tool (`drop_database`) is rejected, not executed.
3. Tool exception becomes an `error:` observation.
4. Infinite tool loop stops at `max_steps`.

## Python essentials likely to come up
- **GIL:** one thread executes Python bytecode at a time → threads don't speed CPU-bound code; use `multiprocessing`/native libs; threads/async are fine for I/O. (3.13 has an experimental free-threaded build.)
- **`asyncio`:** single-threaded cooperative concurrency; `await` yields to the loop; use `asyncio.gather`; don't call blocking code inside coroutines.
- **Generators/iterators**, context managers (`with`), decorators, dataclasses, type hints (`typing`, `Protocol`), `pydantic` for validation, `pytest`/`unittest`, virtualenvs, `__slots__`, mutable default arguments pitfall, `is` vs `==`, list comprehension vs generator expression, copy vs deepcopy.
- Packaging/deps: `venv`+`pip`, `uv`/`poetry`, lock files; `python -I` isolates from user site/cwd.

## Interview Q&A
**Q: How does tool calling work end to end?** Provide tool schemas; model replies with `tool_use`; your code validates and executes, returns `tool_result`; model continues. Loop until a text answer or a step limit.

**Q: How do you make an agent reliable?** Narrow, well-described tools; strict schemas; allow-lists; bounded loops; errors fed back as observations; evals + regression tests; logging/tracing; human-in-the-loop for high-risk actions.

**Q: How do you test non-deterministic LLM code?** Separate deterministic logic (loop, tools, parsing) and test with a scripted fake; then run an **eval suite** against the real model (pass-rate thresholds, LLM-judge, golden tool-call traces).

**Q: What is prompt injection and how do you mitigate it?** Malicious instructions inside data the model reads. Mitigate: treat tool output as data, least privilege, no secrets in context, confirmation for side effects, output filtering, separate planning from untrusted content.

**Q: RAG vs fine-tuning?** RAG injects fresh/private knowledge at query time (cheap to update, citable). Fine-tuning changes behavior/style/format. Start with prompting + RAG.

**Q: How would you use agents at a real-estate company?** Listing Q&A and search, drafting listing descriptions, summarizing inspection reports/contracts, lead triage, scheduling tours. Read-only tools first; any action (offer, email) behind human approval.

**Q: How do you control cost?** Cache prefixes, smaller models for simple steps, limit steps/tokens, truncate tool outputs, batch requests.

**Q: What does `max_steps` protect against?** Infinite loops, runaway cost, and prompt-injection-driven tool spam.
