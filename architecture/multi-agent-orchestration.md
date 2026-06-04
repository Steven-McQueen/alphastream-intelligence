# Multi-Agent Orchestration — Vision & Build Plan

> The long-term plan for AlphaStream's AI: specialist agents coordinated by a
> supervisor ("CEO"), with a visual map of the whole system. Authored
> 2026-06-04. Status: **planned & approved; not yet started.** Builds directly
> on the agentic engine in `architecture/agentic-fmp-tools.md`.

---

## 1. Vision

Many specialist agents (financial_advisor, news_scanner, quant_explainer, …)
coordinated by a **supervisor / "CEO"** that routes or decomposes a request to
the right specialist. The future **omniscience** page is the Jarvis-style
*orchestrator chat* surface where the AI is in control and can eventually take
action / build things. This document covers the foundation that makes that
possible, plus the **Atlas** page that visualizes it.

Two distinct surfaces (do not conflate):
- **omniscience** — the orchestrator *chat* (Jarvis). Future.
- **Atlas** — the *map/overview* of agents + database. Built in this plan.

---

## 2. Locked decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Invocation | **Both** LLM-routing *and* slash commands, over one registry | Router = Jarvis default; slash = deterministic/cheap shortcut. Both derive from the same registry, so no duplication. |
| Skills layer | **Deferred** until 2-3 real repeated playbooks exist | Avoid premature abstraction. tools ⊂ skills ⊂ agents. |
| Atlas map style | **Both** — hierarchical DAG default + organic-graph toggle | Hierarchy reads best; organic toggle for the visual. |
| Atlas scope | **Agent map + DB schema overview** | One "system overview" surface. |
| Page name | **Atlas** (`/atlas`); omniscience kept separate | Non-generic; "collection of maps". |
| Map library | **React Flow (`@xyflow/react`)** + `dagre`/`elkjs` auto-layout | Standard for node graphs in React. (New dep — approved.) |
| **Execution model** | **Single-call profile-switching by default**; orchestration (nested specialist calls) is opt-in | Don't make N API calls for one question. Same model + same pipeline, swap persona/context/tools. |
| **Model authority** | The user's selected model is **always** used | A profile may carry a *suggested* model, used only when the user hasn't chosen; explicit choice wins. |
| **Routing** | "auto-agent" toggle over profile *selection* (manual vs auto); auto = heuristic (0 extra calls) or tiny classifier (1 cheap call) | Routing should rarely cost a full LLM call. |

---

## 3. Core abstraction — an agent is a **profile**, run on ONE model

An "agent" is **not** a separate LLM process. It is a *profile* — a bundle of
context — applied to the single model the user selected, through the same
pipeline. The motor never changes; the framing does.

```
agent (profile) = persona (system prompt)
                + context recipe (which files/data to pull, + grounding mode)
                + tool subset
                + suggested model (used only if the user hasn't chosen)
                + process_doc

grounding mode = "inject"  -> pre-fetch context, ONE call          (cheap; default)
                 "tools"   -> model fetches via tool loop, 1-few calls (when it must decide)
```

Execution of a normal turn (no orchestration):
1. **Select profile** — manual (slash/dropdown) or auto (heuristic/classifier).
2. **Assemble context** per the profile's recipe (load files + pull FMP data).
3. **One call** to the *user's selected model* with persona + context (+ tools
   if grounding = "tools").

This is rungs 1–3 of the agent ladder (persona → context/RAG → tools), which is
where the vast majority of turns live. It reuses the engine already built:
profile "inject" = the Phase-1 grounding path; profile "tools" = the Phase-2
agent loop, restricted to that profile's tool subset.

### Orchestration (rung 4) — opt-in, rare
A **supervisor** is a profile whose tools are *other agents*
(`consult_<specialist>` = agent-as-tool handoff). This is the only mode that
makes multiple LLM calls, so it is **opt-in** (e.g. an "orchestrate" mode or the
future omniscience page), reserved for genuinely decomposable tasks — never the
default. It reuses the same `agent_loop`, just one level up.

```
registry ──┬──▶ profile selection (manual /slash  OR  auto-agent toggle)
           ├──▶ ONE call on the selected model  (default path, rungs 1-3)
           ├──▶ supervisor orchestration         (opt-in, rung 4)
           ├──▶ Settings → Agents tab            (manage)
           └──▶ Atlas map + DB overview          (visualize)
```

One registry is the single source of truth, so profile selection, slash
commands, Settings, and Atlas all stay in sync automatically.

---

## 4. Build plan

### Workstream 1 — Agent registry (the spine; everything depends on it)
1. DB tables `agents` + `agent_tools` (mirrors `ai_models`/`ai_providers`) + idempotent seed migration. Fields: `slug`, `name`, `persona`, `suggested_model_id` (nullable; user choice wins), `role` (specialist|supervisor), `grounding_mode` (inject|tools), `context_sources` (files/data directives), `process_doc` (markdown), `enabled`, `visible`, `is_default`, `sort_order`.
2. `services/chat/agents/registry.py` — `AgentSpec` (profile) + DB load with static fallback + cache/invalidate (same shape as `provider_registry.py`).
3. Seed `financial_advisor` (persona + FMP tools/inject + no forced model) and a `supervisor` profile (tools = agent-as-tool handoffs; used only in orchestration mode).
4. Generalize the run path to accept a profile: persona + tool subset + grounding mode, executed on the **user's selected model**.

### Workstream 2 — Profile selection (the two doors) + single-call default
1. **Default = one call.** Chat request carries an optional `agent` slug + the selected `model_id`. Resolve profile → assemble context (inject) or expose its tools → **one call on the selected model**.
2. **Manual door:** slash `/slug` + composer `/` menu (reuses `ModelSelector` style); absent → default profile.
3. **auto-agent toggle:** when on, a cheap selector (heuristic/embeddings first; tiny classifier only if needed) picks the profile — no full extra LLM call by default.
4. **Orchestration (opt-in, deferred to batch C):** supervisor `consult_<specialist>` handoffs that recurse into the run path. Off by default; this is the only multi-call path.

### Workstream 3 — Settings "Agents" tab
- `GET/PUT /api/agents` (auth + cache-invalidate, like `/api/ai-config`).
- Tab mirroring `AiModelsSettings`: edit persona, model, tools, slug, enabled, `process_doc`.

### Workstream 4 — Atlas page (`/atlas`)
1. Backend: `GET /api/atlas/graph` → nodes (agents + tools) + edges (handoffs, agent→tools); `GET /api/atlas/schema` → curated, read-only DB table/relationship map.
2. Agent map: React Flow, hierarchical DAG default + organic toggle, auto-laid-out (dagre/elk). Node click → drawer: persona, model, tools, `process_doc` (markdown).
3. DB schema section on the same page.
4. Reads live registry + schema → self-updating for every new agent.

### Workstream 5 — Docs
- This file is the shared plan; cross-link from `agentic-fmp-tools.md`.
- Keep updated as agents are added (per-agent `process_doc` lives on the agent record, so Atlas documents itself).

### Sequencing
WS1 → (WS2 + WS3 + WS4 in parallel) → WS5.

### Batches
- **This batch (B):** WS1, WS2 (slash + direct + supervisor plumbing), WS3 (minimal agents tab), WS4 (full Atlas page), WS5.
- **Next batch (C):** real `news_scanner` + `quant_explainer`, full LLM routing on, agent-activity events in the SSE stream + live "who's active" highlight on Atlas.

---

## 5. Cautions (carried from the agentic design)
- Nested agent calls multiply cost/latency — keep handoff depth shallow, cheap model for the router.
- Separate **read** tools from **act/build** tools; the act tier needs approval gates + sandboxing (a later trust level).
- Start with 2-3 real agents + router; don't build a framework for 50.
- Hand specialists a clean sub-task brief, not the full chat history.
- DB schema view is **curated/whitelisted**, not raw introspection.

---

## 6. Current status
- Agentic engine (tools, agent_loop, 3 provider adapters, dispatcher): **shipped**, on branch `feature/agentic-fmp-copilot` (see `agentic-fmp-tools.md`).
- This multi-agent layer: **planned, awaiting go to start Workstream 1.**
