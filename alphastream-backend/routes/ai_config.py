"""GET/PUT /api/ai-config — persisted AI provider/model catalog (admin settings).

Requires Supabase JWT (same pattern as chat threads).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import ai_model_store
from middleware.supabase_auth import get_current_user_id
from services.chat.provider_registry import invalidate_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-config")


class ModelConfigBody(BaseModel):
    model_id: str
    display_label: str
    version: str = ""
    provider_native_model_name: str
    enabled: bool = False
    visible: bool = False
    is_default: bool = False


class ProviderConfigBody(BaseModel):
    provider_id: str
    name: str
    models: List[ModelConfigBody] = Field(default_factory=list)


class AiConfigBody(BaseModel):
    providers: List[ProviderConfigBody]


def _body_to_dict(body: AiConfigBody) -> Dict[str, Any]:
    return {
        "providers": [
            {
                "provider_id": p.provider_id,
                "name": p.name,
                "models": [
                    {
                        "model_id": m.model_id,
                        "display_label": m.display_label,
                        "version": m.version,
                        "provider_native_model_name": m.provider_native_model_name,
                        "enabled": m.enabled,
                        "visible": m.visible,
                        "is_default": m.is_default,
                    }
                    for m in p.models
                ],
            }
            for p in body.providers
        ],
    }


@router.get("")
async def get_ai_config(
    _user_id: str = Depends(get_current_user_id),
):
    """Return full provider + model catalog for the settings UI."""
    return ai_model_store.get_all_config()


@router.put("")
async def put_ai_config(
    body: AiConfigBody,
    _user_id: str = Depends(get_current_user_id),
):
    """Replace persisted catalog; validates structure and single default."""
    config = _body_to_dict(body)
    ok, errors = ai_model_store.replace_config(config)
    if not ok:
        raise HTTPException(status_code=422, detail={"errors": errors})

    invalidate_cache()
    return ai_model_store.get_all_config()
