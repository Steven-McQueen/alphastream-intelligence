"""Provider-neutral chat orchestration.

Assembles the system prompt, converts messages, calls the active
provider, and yields normalised SSE events.  Provider selection is a
single dispatch point — swap the import to switch LLMs.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator, List, Dict, Optional

from services.chat.provider_registry import get_provider_module, resolve_model

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """\
You are the AlphaStream Copilot — an AI assistant embedded inside the \
AlphaStream Intelligence Terminal, a professional-grade financial \
analytics platform.

Personality & Constraints:
• Deep expertise in equities, macro, fixed income, portfolio theory, \
  and quantitative finance.
• Conversational, clear, and concise — favour bullets and structure \
  over dense prose.
• You do NOT have access to live market data in this conversation. \
  Never fabricate real-time prices, quotes, or breaking news.
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


def _build_system_prompt(
    context_label: Optional[str] = None,
    chat_mode: Optional[str] = None,
) -> str:
    parts: list[str] = []
    if context_label:
        parts.append(f"The user is currently viewing: {context_label}.")
    if chat_mode:
        parts.append(f"Chat mode: {chat_mode}.")
    context_block = "\n".join(parts)
    return SYSTEM_PROMPT_TEMPLATE.format(context_block=context_block)


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
) -> str:
    """Non-streaming completion (Phase 1 validation helper)."""
    system_prompt = _build_system_prompt(context_label, chat_mode)
    cleaned = _normalise_messages(messages)
    if not cleaned:
        raise ValueError("No valid messages provided")
    spec = resolve_model(model_id)
    provider = get_provider_module(spec.provider)
    return provider.chat(system_prompt, cleaned, api_model_name=spec.api_model_name)


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def stream_chat(
    messages: List[Dict[str, str]],
    context_label: Optional[str] = None,
    chat_mode: Optional[str] = None,
    model_id: Optional[str] = None,
) -> AsyncIterator[str]:
    """Yield SSE-formatted events: ``{"token": "..."}`` then ``{"done": true}``."""
    system_prompt = _build_system_prompt(context_label, chat_mode)
    cleaned = _normalise_messages(messages)
    if not cleaned:
        yield _sse_event({"error": "No valid messages provided"})
        return

    spec = resolve_model(model_id)
    logger.info(
        "[CHAT] Request: model_id=%r -> resolved provider=%s, api_model_name=%s",
        model_id,
        spec.provider,
        spec.api_model_name,
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
