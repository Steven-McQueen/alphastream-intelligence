"""CRUD endpoints for persistent chat threads and messages.

All endpoints require a valid Supabase JWT (``Authorization: Bearer ...``).
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database.chat_store import (
    add_message,
    create_thread,
    delete_thread,
    get_thread,
    list_threads,
)
from middleware.supabase_auth import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat/threads")


# ── Request models ───────────────────────────────────────────────────────────


class CreateThreadRequest(BaseModel):
    title: str
    context_label: Optional[str] = None
    chat_mode: Optional[str] = None
    route_path: Optional[str] = None


class AddMessageRequest(BaseModel):
    role: str
    content: str


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("")
async def create_thread_endpoint(
    body: CreateThreadRequest,
    user_id: str = Depends(get_current_user_id),
):
    thread = create_thread(
        user_id=user_id,
        title=body.title,
        context_label=body.context_label,
        chat_mode=body.chat_mode,
        route_path=body.route_path,
    )
    return thread


@router.get("")
async def list_threads_endpoint(
    user_id: str = Depends(get_current_user_id),
):
    return list_threads(user_id)


@router.get("/{thread_id}")
async def get_thread_endpoint(
    thread_id: str,
    user_id: str = Depends(get_current_user_id),
):
    thread = get_thread(thread_id, user_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@router.delete("/{thread_id}")
async def delete_thread_endpoint(
    thread_id: str,
    user_id: str = Depends(get_current_user_id),
):
    deleted = delete_thread(thread_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Thread not found")
    return {"ok": True}


@router.post("/{thread_id}/messages")
async def add_message_endpoint(
    thread_id: str,
    body: AddMessageRequest,
    user_id: str = Depends(get_current_user_id),
):
    if body.role not in ("user", "assistant"):
        raise HTTPException(status_code=422, detail="role must be 'user' or 'assistant'")
    if not body.content.strip():
        raise HTTPException(status_code=422, detail="content must not be empty")

    msg = add_message(
        thread_id=thread_id,
        user_id=user_id,
        role=body.role,
        content=body.content.strip(),
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Thread not found")
    return msg
