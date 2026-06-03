"""Model registry and provider resolution for chat routing.

Phase 4: load enabled models from persisted DB config with in-memory cache.
Falls back to static seed when DB is unavailable or lookup fails.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_MODEL_ID = "gemini-flash"


def _provider_has_api_key(provider_display: str) -> bool:
    """True when the backend has credentials for this provider."""
    from config import (
        ANTHROPIC_API_KEY,
        DEEPSEEK_API_KEY,
        GEMINI_API_KEY,
        MOONSHOT_API_KEY,
        OPENAI_API_KEY,
    )

    if provider_display == "google":
        return bool(GEMINI_API_KEY)
    if provider_display == "openai":
        return bool(OPENAI_API_KEY)
    if provider_display == "anthropic":
        return bool(ANTHROPIC_API_KEY)
    if provider_display == "moonshot":
        return bool(MOONSHOT_API_KEY)
    if provider_display == "deepseek":
        return bool(DEEPSEEK_API_KEY)
    return False


@dataclass(frozen=True)
class ModelSpec:
    """Resolved model entry used by chat_service for dispatch."""

    model_id: str
    provider: str  # internal module key: gemini | openai | anthropic
    api_model_name: str
    display_label: str
    provider_display: str  # API-facing: google | openai | anthropic
    enabled: bool = True
    visible: bool = True
    is_default: bool = False


_STATIC_MODELS: Dict[str, ModelSpec] = {
    "gemini-flash": ModelSpec(
        model_id="gemini-flash",
        provider="gemini",
        api_model_name="gemini-2.5-flash",
        display_label="Gemini 2.5 Flash",
        provider_display="google",
        enabled=True,
        visible=True,
        is_default=True,
    ),
    "gpt-4o": ModelSpec(
        model_id="gpt-4o",
        provider="openai",
        api_model_name="gpt-4o",
        display_label="GPT-4o",
        provider_display="openai",
        enabled=False,
        visible=False,
    ),
    "gpt-4o-mini": ModelSpec(
        model_id="gpt-4o-mini",
        provider="openai",
        api_model_name="gpt-4o-mini",
        display_label="GPT-4o Mini",
        provider_display="openai",
        enabled=False,
        visible=False,
    ),
    "claude-sonnet": ModelSpec(
        model_id="claude-sonnet",
        provider="anthropic",
        api_model_name="claude-sonnet-4-20250514",
        display_label="Claude Sonnet 4",
        provider_display="anthropic",
        enabled=False,
        visible=False,
    ),
    "kimi-k2": ModelSpec(
        model_id="kimi-k2",
        provider="moonshot",
        api_model_name="kimi-k2.6",
        display_label="Kimi K2.6",
        provider_display="moonshot",
        enabled=True,
        visible=True,
    ),
    "deepseek-v4-pro": ModelSpec(
        model_id="deepseek-v4-pro",
        provider="deepseek",
        api_model_name="deepseek-v4-pro",
        display_label="DeepSeek V4 Pro",
        provider_display="deepseek",
        enabled=True,
        visible=True,
    ),
}

_runtime_cache: Optional[Dict[str, ModelSpec]] = None


def invalidate_cache() -> None:
    """Clear cached DB models (call after PUT /api/ai-config)."""
    global _runtime_cache
    _runtime_cache = None


def _spec_from_row(row: Dict[str, Any]) -> ModelSpec:
    return ModelSpec(
        model_id=row["model_id"],
        provider=row["provider"],
        api_model_name=row["api_model_name"],
        display_label=row["display_label"],
        provider_display=row["provider_display"],
        enabled=bool(row.get("enabled", True)),
        visible=bool(row.get("visible", True)),
        is_default=bool(row.get("is_default", False)),
    )


def _load_runtime_models() -> Dict[str, ModelSpec]:
    global _runtime_cache
    if _runtime_cache is not None:
        return _runtime_cache

    models: Dict[str, ModelSpec] = dict(_STATIC_MODELS)

    try:
        from database.ai_model_store import get_runtime_specs

        db_specs = get_runtime_specs()
        if db_specs:
            models = {
                mid: _spec_from_row(row) for mid, row in db_specs.items()
            }
    except Exception as exc:
        logger.warning("[REGISTRY] DB load failed, using static fallback: %s", exc)

    _runtime_cache = models
    return models


def _get_models() -> Dict[str, ModelSpec]:
    return _load_runtime_models()


def resolve_model(model_id: Optional[str]) -> ModelSpec:
    """Resolve ``model_id`` to a ModelSpec; fall back to default Gemini."""
    models = _get_models()
    if model_id:
        spec = models.get(model_id)
        if spec is not None:
            return spec
    default = models.get(DEFAULT_MODEL_ID)
    if default is not None:
        return default
    return _STATIC_MODELS[DEFAULT_MODEL_ID]


def get_provider_module(provider_name: str) -> Any:
    """Return the provider adapter module for ``provider_name``."""
    if provider_name == "gemini":
        from services.chat import gemini_provider

        return gemini_provider
    if provider_name == "openai":
        from services.chat import openai_provider

        return openai_provider
    if provider_name == "anthropic":
        from services.chat import anthropic_provider

        return anthropic_provider
    if provider_name == "moonshot":
        from services.chat import moonshot_provider

        return moonshot_provider
    if provider_name == "deepseek":
        from services.chat import deepseek_provider

        return deepseek_provider
    raise ValueError(f"Unknown provider: {provider_name}")


def list_enabled_models() -> List[Dict[str, str]]:
    """Models for composer: enabled AND visible, plus provider must have API key."""
    return [
        {
            "id": spec.model_id,
            "display_label": spec.display_label,
            "provider": spec.provider_display,
        }
        for spec in _get_models().values()
        if spec.enabled and spec.visible and _provider_has_api_key(spec.provider_display)
    ]


def get_default_model_id() -> str:
    """Default model_id from catalog, or gemini-flash."""
    for spec in _get_models().values():
        if spec.is_default and spec.enabled:
            return spec.model_id
    return DEFAULT_MODEL_ID
