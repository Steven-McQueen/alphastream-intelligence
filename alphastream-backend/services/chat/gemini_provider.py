"""Gemini SDK wrapper for multi-turn chat.

This module is the *only* place that imports google-genai for chat.
It exposes a provider-neutral interface so callers never touch SDK types.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator, List, Dict

from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)


def _get_client():
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    try:
        from google import genai
    except ImportError as exc:
        raise RuntimeError(
            "google-genai is not installed. Run: pip install google-genai"
        ) from exc
    return genai.Client(api_key=GEMINI_API_KEY)


def _to_gemini_contents(
    system_prompt: str,
    messages: List[Dict[str, str]],
) -> list:
    """Convert normalised messages into Gemini's Content list.

    Gemini expects ``role`` to be either ``"user"`` or ``"model"``.
    The system instruction is passed separately, not as a content turn.
    """
    contents = []
    for msg in messages:
        role = msg["role"]
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": msg["content"]}]})
    return contents


def chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    api_model_name: str | None = None,
) -> str:
    """Blocking single-shot completion (Phase 1 validation)."""
    from google.genai import types

    client = _get_client()
    contents = _to_gemini_contents(system_prompt, messages)
    model = api_model_name or GEMINI_MODEL

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
        ),
    )
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise RuntimeError("Gemini returned empty response")
    return text


_STREAM_SENTINEL = object()

# Number of chunks drained per executor hop.  Keeping this small preserves
# streaming responsiveness while cutting the number of thread-pool round-trips.
_STREAM_BATCH_SIZE = 8


async def stream_chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    api_model_name: str | None = None,
) -> AsyncIterator[str]:
    """Yield text chunks from Gemini's streaming API.

    ``generate_content_stream`` returns a synchronous iterator whose
    ``next()`` does blocking network I/O.  Each call is offloaded to
    the default thread-pool executor so the event loop stays free.
    """
    from google.genai import types
    import asyncio

    client = _get_client()
    contents = _to_gemini_contents(system_prompt, messages)
    model = api_model_name or GEMINI_MODEL

    loop = asyncio.get_running_loop()

    def _create_stream():
        return client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
            ),
        )

    stream = await loop.run_in_executor(None, _create_stream)

    def _read_batch() -> tuple[str, bool]:
        """Drain up to ``_STREAM_BATCH_SIZE`` chunks in a single executor hop.

        Returns the coalesced text for the batch and a flag indicating the
        stream is exhausted.  Coalescing reduces the per-token thread-pool
        round-trip overhead while preserving chunk ordering and the final
        flush (a partial batch still returns its accumulated text alongside
        ``done=True``).
        """
        parts: list[str] = []
        for _ in range(_STREAM_BATCH_SIZE):
            chunk = next(stream, _STREAM_SENTINEL)
            if chunk is _STREAM_SENTINEL:
                return "".join(parts), True
            text = getattr(chunk, "text", None) or ""
            if text:
                parts.append(text)
        return "".join(parts), False

    while True:
        text, done = await loop.run_in_executor(None, _read_batch)
        if text:
            yield text
        if done:
            break
