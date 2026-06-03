"""OpenAI SDK wrapper for multi-turn chat streaming."""

from __future__ import annotations

import logging
from typing import AsyncIterator, Dict, List

from config import OPENAI_API_KEY

logger = logging.getLogger(__name__)


def _get_client():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise RuntimeError(
            "openai package is not installed. Run: pip install openai"
        ) from exc
    return AsyncOpenAI(api_key=OPENAI_API_KEY)


def chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    api_model_name: str,
) -> str:
    """Blocking single-shot completion."""
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError(
            "openai package is not installed. Run: pip install openai"
        ) from exc
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=api_model_name,
        messages=_to_openai_messages(system_prompt, messages),
        temperature=0.7,
    )
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("OpenAI returned empty response")
    return text


def _to_openai_messages(
    system_prompt: str,
    messages: List[Dict[str, str]],
) -> list:
    out = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        out.append({"role": msg["role"], "content": msg["content"]})
    return out


async def stream_chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    api_model_name: str,
) -> AsyncIterator[str]:
    """Yield text chunks from OpenAI's streaming chat completions API."""
    client = _get_client()
    openai_messages = _to_openai_messages(system_prompt, messages)

    stream = await client.chat.completions.create(
        model=api_model_name,
        messages=openai_messages,
        temperature=0.7,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content
