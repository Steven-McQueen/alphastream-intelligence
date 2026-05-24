"""POST /api/chat — SSE streaming chat endpoint."""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.chat.chat_service import stream_chat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessageIn]
    contextLabel: Optional[str] = None
    chatMode: Optional[str] = None


@router.post("/chat")
async def chat_endpoint(body: ChatRequest):
    messages = [m.model_dump() for m in body.messages]

    async def event_generator():
        async for event in stream_chat(
            messages=messages,
            context_label=body.contextLabel,
            chat_mode=body.chatMode,
        ):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
