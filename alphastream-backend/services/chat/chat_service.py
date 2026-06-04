"""Provider-neutral chat orchestration.

Assembles the system prompt, converts messages, calls the active
provider, and yields normalised SSE events.  Provider selection is a
single dispatch point — swap the import to switch LLMs.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, List, Dict, Optional

from config import CHAT_AGENTIC_ENABLED
from services.chat import agent_loop, tools
from services.chat.agents import registry as agent_registry
from services.chat.agents.selector import select_agent
from services.chat.grounding import build_grounding_block
from services.chat.provider_registry import get_provider_module, resolve_model

logger = logging.getLogger(__name__)

# Default persona used when an agent profile does not override it.
DEFAULT_PERSONA = (
    "You are the AlphaStream Copilot — an AI assistant embedded inside the "
    "AlphaStream Intelligence Terminal, a professional-grade financial "
    "analytics platform."
)

# The persona leads; the shared rules (data grounding + formatting) are the
# same regardless of which agent profile is active.
SYSTEM_PROMPT_TEMPLATE = """\
{persona}

Personality & Constraints:
• Deep expertise in equities, macro, fixed income, portfolio theory, \
  and quantitative finance.
• Conversational, clear, and concise — favour bullets and structure \
  over dense prose.
• You can access real, current market data — through tools you can call \
  and/or a "LIVE MARKET DATA" block below. Always ground prices, quotes, \
  fundamentals, analyst views and news in that real data, cite specific \
  numbers, and prefer it over your training knowledge. Never fabricate \
  real-time figures; if you cannot retrieve them, say so.
• If you don't know something, say so honestly.
• When appropriate, reference financial concepts, ratio definitions, \
  or analytical frameworks to educate the user.

Formatting rules:
• Reply in Markdown by default.
• Use short paragraphs and bullet points where they improve clarity.
• Use headings only when the answer has distinct sections.
• Use tables only when they genuinely aid comparison.
• Use fenced code blocks (with language tag) for any code or formulas.
• Do NOT output raw HTML.
• Keep formatting clean, compact, and readable — avoid over-formatting.

{context_block}\
"""


def _tools_guidance(tool_names: list[str]) -> str:
    """Tool-use instructions naming exactly the active agent's tools."""
    if not tool_names:
        return ""
    return (
        "You can call tools to retrieve real, current data from Financial "
        "Modeling Prep: " + ", ".join(tool_names) + ". When the user asks "
        "about specific companies/tickers or anything needing current "
        "numbers, CALL the relevant tool(s) instead of guessing. If the user "
        "names a company without a ticker, call search_symbol first. Make "
        "multiple calls when comparing companies. Base every figure on tool "
        "results and cite them; if a tool returns no data, say so plainly."
    )


def _build_system_prompt(
    persona: Optional[str] = None,
    context_label: Optional[str] = None,
    chat_mode: Optional[str] = None,
    grounding_block: Optional[str] = None,
    tools_guidance: Optional[str] = None,
) -> str:
    parts: list[str] = []
    if context_label:
        parts.append(f"The user is currently viewing: {context_label}.")
    if chat_mode:
        parts.append(f"Chat mode: {chat_mode}.")
    if tools_guidance:
        parts.append(tools_guidance)
    if grounding_block:
        parts.append(grounding_block)
    context_block = "\n\n".join(parts)
    return SYSTEM_PROMPT_TEMPLATE.format(
        persona=persona or DEFAULT_PERSONA, context_block=context_block
    )


async def _safe_grounding(
    cleaned: List[Dict[str, str]],
    context_label: Optional[str],
) -> str:
    """Build the Phase-1 grounding block off the event loop; never raise."""
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            build_grounding_block,
            _latest_user_message(cleaned),
            context_label,
        )
    except Exception as exc:
        logger.warning("[CHAT] Grounding failed, continuing ungrounded: %s", exc)
        return ""


def _latest_user_message(messages: List[Dict[str, str]]) -> str:
    """Text of the most recent user turn, used to resolve tickers."""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            return msg.get("content") or ""
    return ""


def _normalise_messages(raw: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Validate and clean incoming messages."""
    valid_roles = {"user", "assistant"}
    cleaned: List[Dict[str, str]] = []
    for msg in raw:
        role = msg.get("role", "")
        content = (msg.get("content") or "").strip()
        if role not in valid_roles or not content:
            continue
        cleaned.append({"role": role, "content": content})
    return cleaned


def chat_blocking(
    messages: List[Dict[str, str]],
    context_label: Optional[str] = None,
    chat_mode: Optional[str] = None,
    model_id: Optional[str] = None,
    agent_slug: Optional[str] = None,
) -> str:
    """Non-streaming completion (validation helper; inject grounding)."""
    cleaned = _normalise_messages(messages)
    if not cleaned:
        raise ValueError("No valid messages provided")
    agent = agent_registry.resolve_agent(agent_slug)
    grounding_block = build_grounding_block(
        _latest_user_message(cleaned), context_label
    )
    system_prompt = _build_system_prompt(
        agent.persona, context_label, chat_mode, grounding_block=grounding_block
    )
    spec = resolve_model(model_id or agent.suggested_model_id)
    provider = get_provider_module(spec.provider)
    return provider.chat(system_prompt, cleaned, api_model_name=spec.api_model_name)


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def stream_chat(
    messages: List[Dict[str, str]],
    context_label: Optional[str] = None,
    chat_mode: Optional[str] = None,
    model_id: Optional[str] = None,
    agent_slug: Optional[str] = None,
) -> AsyncIterator[str]:
    """Yield SSE events: ``{"token"|"tool_call"|"tool_result"}`` then ``{"done": true}``.

    Resolves an agent *profile* (persona + grounding mode + tool subset) and
    runs it on the user's selected model:
      * grounding_mode "tools" → agentic loop with the agent's tool subset.
      * grounding_mode "inject" → pre-fetch context, single model call.
    A tools-mode failure *before emitting anything* falls back to inject so the
    chat still answers. The selected model always wins over the agent's
    suggested model.
    """
    cleaned = _normalise_messages(messages)
    if not cleaned:
        yield _sse_event({"error": "No valid messages provided"})
        return

    # "auto" → cheap heuristic selector picks the agent (no extra LLM call).
    if agent_slug == "auto":
        agent_slug = select_agent(_latest_user_message(cleaned), context_label)
    agent = agent_registry.resolve_agent(agent_slug)
    spec = resolve_model(model_id or agent.suggested_model_id)
    agent_tools = [t for t in agent.tool_names if tools.has_tools([t])]
    use_tools = (
        CHAT_AGENTIC_ENABLED
        and agent.grounding_mode == "tools"
        and bool(agent_tools)
    )
    logger.info(
        "[CHAT] agent=%s mode=%s model_id=%r -> %s/%s tools=%d",
        agent.slug, agent.grounding_mode, model_id,
        spec.provider, spec.api_model_name, len(agent_tools),
    )

    # Tell the client which agent is answering (for the "via <Agent>" tag).
    yield _sse_event({"agent": {"slug": agent.slug, "name": agent.name}})

    if use_tools:
        system_prompt = _build_system_prompt(
            agent.persona, context_label, chat_mode,
            tools_guidance=_tools_guidance(agent_tools),
        )
        emitted = False
        try:
            async for event in agent_loop.run_agent(
                spec.provider, spec.api_model_name, system_prompt, cleaned,
                tool_names=list(agent_tools),
            ):
                emitted = True
                yield _sse_event(event)
            yield _sse_event({"done": True})
            return
        except Exception as exc:
            # Only safe to fall back if nothing has been streamed yet.
            if emitted:
                logger.exception("[CHAT] Agentic stream failed mid-response: %s", exc)
                yield _sse_event({
                    "error": f"Chat failed ({spec.provider}/{spec.api_model_name}): "
                             f"{type(exc).__name__}: {exc}"
                })
                return
            logger.warning(
                "[CHAT] Agentic path failed for %s/%s (%s); falling back to injection",
                spec.provider, spec.api_model_name, type(exc).__name__,
            )

    # Inject path: grounding_mode "inject", agentic disabled, or tools fallback.
    grounding_block = await _safe_grounding(cleaned, context_label)
    system_prompt = _build_system_prompt(
        agent.persona, context_label, chat_mode, grounding_block=grounding_block
    )
    provider = get_provider_module(spec.provider)

    try:
        async for chunk in provider.stream_chat(
            system_prompt, cleaned, api_model_name=spec.api_model_name
        ):
            yield _sse_event({"token": chunk})
        yield _sse_event({"done": True})
    except Exception as exc:
        logger.exception(
            "[CHAT] Streaming error (model_id=%s, provider=%s, api_model=%s): %s",
            spec.model_id,
            spec.provider,
            spec.api_model_name,
            exc,
        )
        yield _sse_event({
            "error": f"Chat failed ({spec.provider}/{spec.api_model_name}): {type(exc).__name__}: {exc}"
        })
