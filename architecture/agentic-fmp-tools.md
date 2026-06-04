# Agentic FMP Tools — Architecture & Build Plan

> Design + implementation of giving the AlphaStream Copilot real,
> on-demand access to Financial Modeling Prep data via LLM tool-calling.
> Authored 2026-06-04. Status: **Phase 1 + Phase 2 shipped.** Agentic loop
> live-validated on Gemini and Moonshot; OpenAI/Anthropic/DeepSeek adapters
> shape-validated (reach provider; blocked only by billing/auth, not code).

| Item | Value |
|------|-------|
| Providers supported | 5 (Gemini, OpenAI, Anthropic, Moonshot, DeepSeek) |
| Provider adapters | 3 (OpenAI-style covers OpenAI/Moonshot/DeepSeek) |
| Tool source | Native FMP accessors (MCP-ready seam) |
| FMP tools exposed | 7 (search, snapshot, fundamentals, analyst, news, peers, statements) |
| New backend files | `tools.py`, `agent_loop.py` (+ Phase 1 `market_data.py`, `grounding.py`) |

---

## 1. Executive Summary

The copilot gains real FMP data through **two complementary layers**:

- **Phase 1 — Context injection (shipped).** Before the model is called, the
  backend resolves the ticker(s) in play (page context + message text), pulls
  data via the `market_data.py` accessors, and injects a compact
  `LIVE MARKET DATA` block into the system prompt. Provider-agnostic, zero
  per-SDK work, always-on baseline grounding. See
  `services/chat/grounding.py`.

- **Phase 2 — Agentic tool-calling (this doc).** The model is given the FMP
  tools and an agent loop: it decides what to fetch, the backend executes the
  tools and feeds results back, repeating until the model produces a final
  answer. This handles open-ended, multi-entity, multi-step questions
  ("compare AAPL vs MSFT margins and tell me who analysts prefer").

The chosen tool source is **native accessors, structured as an MCP-ready
registry** — the agent loop and per-provider wiring are identical whether
tools come from our accessors or an external FMP MCP server, so we build the
hard part once and keep the MCP door open (see §7).

---

## 2. Why this design (decision record)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tool source | Native accessors, MCP-ready registry | The agent loop is the hard, shared work regardless of source. FMP MCP's ~250 tools need filtering anyway, and Gemini/Moonshot/DeepSeek need manual bridging either way. Reuses the Phase-1 data layer, no new infra, full cost control. |
| Provider scope | All five | Tractable because Moonshot+DeepSeek+OpenAI share one OpenAI-style function-calling shape → only 3 adapters. |
| Streaming | Non-streamed tool turns, chunked final answer | Uniform + robust across 3 SDK families; avoids three different delta-parsers. Upgrade to true token streaming is local to each runner. |
| Phase 1 vs 2 | Coexist, Phase 2 primary when enabled | Agentic path lets the model fetch on demand; Phase-1 injection remains the graceful fallback if a provider's tool-calling fails. |

---

## 3. File Responsibility Map

### Backend (all shipped)

| File | Responsibility |
|------|---------------|
| `services/chat/market_data.py` | FMP accessor layer: `company_snapshot`, `fundamentals`, `analyst_view`, `recent_news`, `gather_symbol_data`. Structured dicts, fault-isolated. |
| `services/chat/grounding.py` | Symbol resolver + `build_grounding_block` (Phase 1 injection). |
| `services/chat/tools.py` | **Provider-neutral tool registry.** `ToolSpec` (name/description/JSON-schema/handler), 7 FMP tools, `execute_tool`, exporters `to_openai_tools` / `to_anthropic_tools` / `to_gemini_declarations`. The MCP-ready seam. |
| `services/chat/agent_loop.py` | **Agent loops + dispatcher.** `run_openai_agent` / `run_gemini_agent` / `run_anthropic_agent` (async generators, normalized events §5) + `run_agent(provider, model, system_prompt, history)` mapping `spec.provider` → runner + that provider's `_get_client()`. |
| `services/chat/chat_service.py` | Agentic branch (tool-aware system prompt → streams `run_agent` events as SSE) with **fall-back to Phase-1 injection** when the agentic path fails before emitting anything. |
| `services/fmp_client.py` | `search_symbol(query)` (name→ticker, US exchanges first). |
| `config.py` | `CHAT_AGENTIC_ENABLED` (default `true`). |

### Frontend (all shipped)

| File | Work |
|------|------|
| `src/hooks/useChatStream.ts` | Handles `tool_call` / `tool_result` SSE events; exposes `toolActivity` (live label, cleared on first answer token). |
| `src/components/chat/ChatOverlay.tsx` | `ToolActivityIndicator` (spinner + label) shown in place of the typing dots while the agent fetches, e.g. *"Fetching fundamentals (AAPL)…"*. |

---

## 4. Agent Loop — Data Flow

```
user turn ──▶ chat_service.stream_chat
                │  (CHAT_AGENTIC_ENABLED and tools.has_tools())
                ▼
        run_agent(provider, model, system_prompt, history)
                │
                ▼  ┌─────────────────────────────────────────┐
                   │  LOOP (max 5 iterations)                 │
   model turn ◀────┤  1. call model WITH tools                │
                   │  2. tool_calls? ──no──▶ stream final ──▶ done
                   │        │ yes                             │
   tool_call ◀─────┤  3. emit {tool_call}                     │
                   │  4. execute_tool() via registry          │
                   │     (runs market_data / fmp_client)      │
   tool_result ◀───┤  5. emit {tool_result}, append result   │
                   │  6. loop                                 │
                   └─────────────────────────────────────────┘
```

Tool execution is centralized in `tools.execute_tool(name, args)` — it never
raises (returns a JSON `{"error": ...}` instead), and clips oversized results
to stay valid JSON, so one bad/verbose call cannot break the loop or blow the
context window.

---

## 5. Normalized SSE Event Protocol

All three runners yield the same dicts; `chat_service` serializes each as
`data: {json}\n\n` and appends `{"done": true}`:

| Event | Shape | UI meaning |
|-------|-------|-----------|
| Tool requested | `{"tool_call": {"name", "arguments"}}` | Show "fetching X" chip |
| Tool finished | `{"tool_result": {"name", "ok"}}` | Update/clear chip |
| Answer text | `{"token": "..."}` | Append to bubble (existing) |
| Fatal | `{"error": "..."}` | Show error (existing) |
| Stream end | `{"done": true}` | Finalize (existing) |

The frontend already ignores unknown events, so `tool_call`/`tool_result` are
**backward-compatible** — wiring them is purely additive UX.

---

## 6. Provider Adapters (3 for 5 providers)

| Adapter | Providers | Tool format | Tool-call read | Result hand-back |
|---------|-----------|-------------|----------------|------------------|
| `run_openai_agent` | OpenAI, Moonshot, DeepSeek | `tools=[{type:function}]` | `message.tool_calls` | `{role:"tool", tool_call_id, content}` |
| `run_gemini_agent` | Gemini | `Tool(function_declarations=[…])` | `part.function_call` | `Part.from_function_response` (sync call run in executor) |
| `run_anthropic_agent` | Anthropic | `tools=[{input_schema}]` | `tool_use` blocks | `{type:"tool_result", tool_use_id, content}` |

Clients come from each provider module's existing `_get_client()`
(`AsyncOpenAI` for the OpenAI family with per-provider `base_url`,
`genai.Client` for Gemini, `AsyncAnthropic` for Anthropic).

---

## 7. MCP-Ready Seam (Phase 3, future)

The registry in `tools.py` is the single place tools are defined. To add the
FMP MCP server later:

1. Stand up an MCP client (Python `mcp` SDK) connected to the FMP MCP server.
2. Convert each discovered MCP tool into a `ToolSpec` (schema → `parameters`,
   a handler that proxies the call through the MCP client) and register it.
3. **Nothing in `agent_loop.py`, the provider adapters, or `chat_service`
   changes** — they consume `ToolSpec`s, not a source.

Optionally, Anthropic and OpenAI can use *native* remote-MCP passthrough
later; the registry approach keeps that as an additive choice, not a rewrite.

---

## 8. Build Log (shipped 2026-06-04)

All steps complete:

1. ✅ **Dispatcher** — `run_agent` in `agent_loop.py` (provider → runner + client).
2. ✅ **Config** — `CHAT_AGENTIC_ENABLED` in `config.py` (default on).
3. ✅ **Wire `chat_service`** — agentic branch + tool-aware system prompt +
   fallback to Phase-1 injection (only when nothing has streamed yet).
4. ✅ **Live-test on Gemini** — "Compare AAPL vs MSFT net margins + analyst
   view" drove **4 tool calls** (`get_fundamentals`×2, `get_analyst_view`×2)
   and a grounded answer (MSFT 36.15% vs AAPL 26.92%). Gemini
   function-response threading works (role `user` + `Part.from_function_response`).
5. ✅ **Frontend** — `useChatStream` handles the events + exposes `toolActivity`;
   `ChatOverlay` renders `ToolActivityIndicator`.
6. ✅ **Cross-provider smoke** — **Moonshot also ran a live tool call**
   (`get_fundamentals(AAPL)`). OpenAI (429 quota), Anthropic (401 key),
   DeepSeek (402 balance) reached their providers with valid tool payloads —
   blocked only by billing/auth, not code.

### Testing results
- [x] Gemini multi-step: ≥2 tool calls → grounded answer. **Pass (4 calls).**
- [x] OpenAI-style adapter live (Moonshot): real tool call + result. **Pass.**
- [x] OpenAI / Anthropic / DeepSeek: valid request shape reaches provider. **Pass.**
- [x] Tool execution fault-isolated (`execute_tool` returns JSON error). **By design.**
- [x] Agentic failure before first event → falls back to Phase-1 injection. **By design.**
- [ ] OpenAI / Anthropic / DeepSeek full E2E — **deferred until credentialed/funded.**
- [ ] Manual UI pass of the tool-activity indicator in the running app.

---

## 9. Config & Flags

| Flag | Default | Effect |
|------|---------|--------|
| `CHAT_AGENTIC_ENABLED` | `true` | Master switch for the agent loop. Off → Phase-1 injection only. |
| `MAX_ITERATIONS` (`agent_loop.py`) | `5` | Tool round-trips before forcing a final answer. |
| `_MAX_RESULT_CHARS` (`tools.py`) | `6000` | Per-tool-result JSON size cap. |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Gemini function-response threading/role differs from assumption | Live-tested first (step 4); single localized fix if needed. |
| Moonshot/DeepSeek/Anthropic accounts blocked (balance/untested) | Adapters validated for request shape; full E2E deferred until credentialed. |
| Latency from multi-turn tool loops | Tool turns non-streamed but bounded (max 5); Phase-1 injection stays the fast path for the focused symbol. |
| A provider/model lacking function calling | try/except in `chat_service` falls back to Phase-1 injection. |
| Tool-call cost blowup | `MAX_ITERATIONS` + result size cap + precise tool descriptions. |
