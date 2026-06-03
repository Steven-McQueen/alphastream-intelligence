"""Anthropic SDK wrapper for multi-turn chat streaming."""

from __future__ import annotations

import logging
from typing import AsyncIterator, Dict, List

from config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)


def _get_client():
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")
    try:
        from anthropic import AsyncAnthropic
    except ImportError as exc:
        raise RuntimeError(
            "anthropic package is not installed. Run: pip install anthropic"
        ) from exc
    return AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


def chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    api_model_name: str,
) -> str:
    """Blocking single-shot completion."""
    try:
        from anthropic import Anthropic
    except ImportError as exc:
        raise RuntimeError(
            "anthropic package is not installed. Run: pip install anthropic"
        ) from exc
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=api_model_name,
        max_tokens=4096,
        system=system_prompt,
        messages=_to_anthropic_messages(messages),
        temperature=0.7,
    )
    parts = []
    for block in response.content:
        if hasattr(block, "text") and block.text:
            parts.append(block.text)
    text = "".join(parts).strip()
    if not text:
        raise RuntimeError("Anthropic returned empty response")
    return text


def _to_anthropic_messages(messages: List[Dict[str, str]]) -> list:
    """Anthropic uses user/assistant roles only (system is separate)."""
    return [{"role": msg["role"], "content": msg["content"]} for msg in messages]


async def stream_chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    api_model_name: str,
) -> AsyncIterator[str]:
    """Yield text chunks from Anthropic's streaming messages API."""
    client = _get_client()
    anthropic_messages = _to_anthropic_messages(messages)

    async with client.messages.stream(
        model=api_model_name,
        max_tokens=4096,
        system=system_prompt,
        messages=anthropic_messages,
        temperature=0.7,
    ) as stream:
        async for text in stream.text_stream:
            if text:
                yield text
