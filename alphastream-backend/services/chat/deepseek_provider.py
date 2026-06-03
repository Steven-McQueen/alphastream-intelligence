"""DeepSeek wrapper for multi-turn chat streaming.

DeepSeek exposes an OpenAI-compatible API, so this provider reuses the
``openai`` SDK pointed at DeepSeek's base URL. Keeping it as its own
module preserves the one-provider-per-module dispatch contract.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator, Dict, List

from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

logger = logging.getLogger(__name__)


def _get_client():
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured")
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise RuntimeError(
            "openai package is not installed. Run: pip install openai"
        ) from exc
    return AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


def _to_openai_messages(
    system_prompt: str,
    messages: List[Dict[str, str]],
) -> list:
    out = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        out.append({"role": msg["role"], "content": msg["content"]})
    return out


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
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured")

    client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
    # No explicit temperature: the reasoner variants ignore/restrict it while
    # the chat variants use their own default. Omitting it keeps the whole
    # DeepSeek family working without a 400 on temperature.
    response = client.chat.completions.create(
        model=api_model_name,
        messages=_to_openai_messages(system_prompt, messages),
    )
    text = (response.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("DeepSeek returned empty response")
    return text


async def stream_chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    api_model_name: str,
) -> AsyncIterator[str]:
    """Yield text chunks from DeepSeek's streaming chat completions API."""
    client = _get_client()
    deepseek_messages = _to_openai_messages(system_prompt, messages)

    # See note in chat(): temperature is omitted so chat and reasoner models
    # all stream without a 400 on temperature.
    stream = await client.chat.completions.create(
        model=api_model_name,
        messages=deepseek_messages,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content
