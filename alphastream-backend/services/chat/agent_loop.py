"""Agentic tool-calling loops, one per provider SDK family.

Each runner is an async generator that drives a multi-turn loop: ask the
model (with the FMP tools from ``tools.py``) -> if it requests tool calls,
execute them and feed the results back -> repeat until the model returns a
final answer, which is streamed out.

All runners yield the same normalized event dicts so ``chat_service`` can
serialize them uniformly:
    {"tool_call": {"name": str, "arguments": dict}}   # model asked for a tool
    {"tool_result": {"name": str, "ok": bool}}        # tool finished
    {"token": str}                                     # final answer text
    {"error": str}                                     # fatal

Tool-resolution turns are non-streamed (uniform + robust across the three
SDKs); the final answer is chunked to keep a streaming feel. Swapping in true
token streaming later is local to each runner.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, List

from services.chat import tools

logger = logging.getLogger(__name__)

# Safety bound on tool round-trips before we force a final answer.
MAX_ITERATIONS = 5


def _chunk(text: str, size: int = 48) -> List[str]:
    """Split text on word boundaries into ~``size``-char pieces for streaming feel."""
    if not text:
        return []
    out: List[str] = []
    buf = ""
    for word in text.split(" "):
        candidate = f"{buf} {word}".strip()
        if len(candidate) >= size:
            out.append(candidate + " ")
            buf = ""
        else:
            buf = candidate
    if buf:
        out.append(buf)
    return out


def _ok(result_json: str) -> bool:
    try:
        return "error" not in json.loads(result_json)
    except Exception:
        return True


# --------------------------------------------------------------------------- #
# OpenAI-compatible (OpenAI, Moonshot, DeepSeek)
# --------------------------------------------------------------------------- #

async def run_openai_agent(
    client: Any,
    system_prompt: str,
    history: List[Dict[str, str]],
    api_model_name: str,
) -> AsyncIterator[Dict[str, Any]]:
    msgs: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    msgs.extend({"role": m["role"], "content": m["content"]} for m in history)
    openai_tools = tools.to_openai_tools()

    for _ in range(MAX_ITERATIONS):
        resp = await client.chat.completions.create(
            model=api_model_name,
            messages=msgs,
            tools=openai_tools,
            tool_choice="auto",
        )
        choice = resp.choices[0].message
        tool_calls = choice.tool_calls or []

        if not tool_calls:
            for piece in _chunk(choice.content or ""):
                yield {"token": piece}
            return

        msgs.append({
            "role": "assistant",
            "content": choice.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in tool_calls
            ],
        })
        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            yield {"tool_call": {"name": name, "arguments": args}}
            result = tools.execute_tool(name, args)
            msgs.append({"role": "tool", "tool_call_id": tc.id, "content": result})
            yield {"tool_result": {"name": name, "ok": _ok(result)}}

    yield {"error": "Agent stopped after too many tool calls."}


# --------------------------------------------------------------------------- #
# Gemini (google-genai)
# --------------------------------------------------------------------------- #

async def run_gemini_agent(
    client: Any,
    system_prompt: str,
    history: List[Dict[str, str]],
    api_model_name: str,
) -> AsyncIterator[Dict[str, Any]]:
    from google.genai import types

    loop = asyncio.get_running_loop()
    gem_tools = [types.Tool(function_declarations=tools.to_gemini_declarations())]
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=gem_tools,
    )

    contents: List[Any] = [
        types.Content(
            role=("model" if m["role"] == "assistant" else "user"),
            parts=[types.Part(text=m["content"])],
        )
        for m in history
    ]

    for _ in range(MAX_ITERATIONS):
        def _call():
            return client.models.generate_content(
                model=api_model_name, contents=contents, config=config
            )

        resp = await loop.run_in_executor(None, _call)
        candidate = resp.candidates[0] if resp.candidates else None
        parts = (candidate.content.parts if candidate and candidate.content else []) or []
        fcalls = [p.function_call for p in parts if getattr(p, "function_call", None)]

        if not fcalls:
            text = getattr(resp, "text", None) or "".join(
                getattr(p, "text", "") or "" for p in parts
            )
            for piece in _chunk(text):
                yield {"token": piece}
            return

        contents.append(candidate.content)
        response_parts = []
        for fc in fcalls:
            name = fc.name
            args = dict(fc.args) if fc.args else {}
            yield {"tool_call": {"name": name, "arguments": args}}
            result = tools.execute_tool(name, args)
            response_parts.append(
                types.Part.from_function_response(
                    name=name, response={"result": json.loads(result)}
                )
            )
            yield {"tool_result": {"name": name, "ok": _ok(result)}}
        contents.append(types.Content(role="user", parts=response_parts))

    yield {"error": "Agent stopped after too many tool calls."}


# --------------------------------------------------------------------------- #
# Anthropic
# --------------------------------------------------------------------------- #

async def run_anthropic_agent(
    client: Any,
    system_prompt: str,
    history: List[Dict[str, str]],
    api_model_name: str,
) -> AsyncIterator[Dict[str, Any]]:
    anthro_tools = tools.to_anthropic_tools()
    msgs: List[Dict[str, Any]] = [
        {"role": m["role"], "content": m["content"]} for m in history
    ]

    for _ in range(MAX_ITERATIONS):
        resp = await client.messages.create(
            model=api_model_name,
            max_tokens=4096,
            system=system_prompt,
            messages=msgs,
            tools=anthro_tools,
        )
        tool_uses = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]

        if not tool_uses:
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", None) == "text"
            )
            for piece in _chunk(text):
                yield {"token": piece}
            return

        # Echo the assistant turn (with tool_use blocks) back verbatim.
        msgs.append({"role": "assistant", "content": resp.content})
        tool_results = []
        for tu in tool_uses:
            args = tu.input if isinstance(tu.input, dict) else {}
            yield {"tool_call": {"name": tu.name, "arguments": args}}
            result = tools.execute_tool(tu.name, args)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": result,
            })
            yield {"tool_result": {"name": tu.name, "ok": _ok(result)}}
        msgs.append({"role": "user", "content": tool_results})

    yield {"error": "Agent stopped after too many tool calls."}
