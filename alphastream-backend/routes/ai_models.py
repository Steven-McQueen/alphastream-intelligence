"""GET /api/chat/models — enabled models from the backend registry."""

from __future__ import annotations

from fastapi import APIRouter

from services.chat.provider_registry import list_enabled_models

router = APIRouter(prefix="/api")


@router.get("/chat/models")
def list_chat_models():
    """Return models available for the composer (enabled in registry only)."""
    return {"models": list_enabled_models()}
