"""Persistent AI provider/model configuration (Supabase PostgreSQL).

Bootstraps from Phase 3 static registry defaults when tables are empty.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import bindparam, text

from config import DATABASE_URL, USE_SQLITE_FALLBACK
from database.chat_store import _get_engine

logger = logging.getLogger(__name__)

VALID_PROVIDER_IDS = frozenset(
    {"google", "openai", "anthropic", "moonshot", "deepseek"}
)
MODEL_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")

# Internal module key per provider_id
# (frontend/API uses google | openai | anthropic | moonshot | deepseek)
PROVIDER_MODULE_MAP = {
    "google": "gemini",
    "openai": "openai",
    "anthropic": "anthropic",
    "moonshot": "moonshot",
    "deepseek": "deepseek",
}

# Seed aligned with Phase 3 provider_registry + frontend DEFAULT_CHAT_MODEL_CONFIG
DEFAULT_CONFIG: Dict[str, Any] = {
    "providers": [
        {
            "provider_id": "google",
            "name": "Google (Gemini)",
            "models": [
                {
                    "model_id": "gemini-flash",
                    "display_label": "Gemini 2.5 Flash",
                    "version": "2.5",
                    "provider_native_model_name": "gemini-2.5-flash",
                    "enabled": True,
                    "visible": True,
                    "is_default": True,
                },
            ],
        },
        {
            "provider_id": "openai",
            "name": "OpenAI",
            "models": [
                {
                    "model_id": "gpt-4o",
                    "display_label": "GPT-4o",
                    "version": "4o",
                    "provider_native_model_name": "gpt-4o",
                    "enabled": False,
                    "visible": False,
                    "is_default": False,
                },
                {
                    "model_id": "gpt-4o-mini",
                    "display_label": "GPT-4o Mini",
                    "version": "4o-mini",
                    "provider_native_model_name": "gpt-4o-mini",
                    "enabled": False,
                    "visible": False,
                    "is_default": False,
                },
            ],
        },
        {
            "provider_id": "anthropic",
            "name": "Anthropic",
            "models": [
                {
                    "model_id": "claude-sonnet",
                    "display_label": "Claude Sonnet 4",
                    "version": "4.6",
                    "provider_native_model_name": "claude-sonnet-4-20250514",
                    "enabled": False,
                    "visible": False,
                    "is_default": False,
                },
            ],
        },
        {
            "provider_id": "moonshot",
            "name": "Moonshot (Kimi)",
            "models": [
                {
                    "model_id": "kimi-k2",
                    "display_label": "Kimi K2.6",
                    "version": "k2.6",
                    "provider_native_model_name": "kimi-k2.6",
                    "enabled": True,
                    "visible": True,
                    "is_default": False,
                },
            ],
        },
        {
            "provider_id": "deepseek",
            "name": "DeepSeek",
            "models": [
                {
                    "model_id": "deepseek-v4-pro",
                    "display_label": "DeepSeek V4 Pro",
                    "version": "v4-pro",
                    "provider_native_model_name": "deepseek-v4-pro",
                    "enabled": True,
                    "visible": True,
                    "is_default": False,
                },
            ],
        },
    ],
}


def is_db_available() -> bool:
    return bool(DATABASE_URL) and not USE_SQLITE_FALLBACK


_schema_ready = False


def ensure_schema() -> bool:
    """Create ai_providers / ai_models tables if missing (Phase 4 migration)."""
    global _schema_ready
    if _schema_ready or not is_db_available():
        return _schema_ready

    try:
        with _get_engine().connect() as conn:
            conn.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS ai_providers (
                        id            TEXT PRIMARY KEY,
                        name          TEXT NOT NULL,
                        display_name  TEXT NOT NULL,
                        enabled       BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
            )
            conn.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS ai_models (
                        id                          TEXT PRIMARY KEY,
                        provider_id                 TEXT NOT NULL
                            REFERENCES ai_providers(id) ON DELETE CASCADE,
                        display_label               TEXT NOT NULL,
                        version                     TEXT NOT NULL DEFAULT '',
                        provider_native_model_name  TEXT NOT NULL,
                        enabled                     BOOLEAN NOT NULL DEFAULT FALSE,
                        visible                     BOOLEAN NOT NULL DEFAULT FALSE,
                        is_default                  BOOLEAN NOT NULL DEFAULT FALSE,
                        sort_order                  INTEGER NOT NULL DEFAULT 0,
                        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
            )
            conn.execute(
                text("""
                    CREATE INDEX IF NOT EXISTS idx_ai_models_provider
                    ON ai_models(provider_id, sort_order)
                """)
            )
            conn.commit()
        _schema_ready = True
        logger.info("[AI_MODEL_STORE] Ensured ai_providers / ai_models tables exist")
        return True
    except Exception as exc:
        logger.warning("[AI_MODEL_STORE] ensure_schema failed: %s", exc)
        return False


def _row_to_model_entry(row: Any) -> Dict[str, Any]:
    m = dict(row._mapping)
    return {
        "model_id": m["id"],
        "display_label": m["display_label"],
        "version": m["version"] or "",
        "provider_native_model_name": m["provider_native_model_name"],
        "enabled": bool(m["enabled"]),
        "visible": bool(m["visible"]),
        "is_default": bool(m["is_default"]),
    }


def _count_providers(conn) -> int:
    return conn.execute(text("SELECT COUNT(*) FROM ai_providers")).scalar() or 0


def bootstrap_if_empty() -> bool:
    """Insert default catalog when tables are empty. Returns True if seeded."""
    if not is_db_available() or not ensure_schema():
        return False
    try:
        with _get_engine().connect() as conn:
            if _count_providers(conn) > 0:
                return False
            _apply_config(conn, DEFAULT_CONFIG)
            conn.commit()
            logger.info("[AI_MODEL_STORE] Seeded default provider/model catalog")
            return True
    except Exception as exc:
        logger.warning("[AI_MODEL_STORE] Bootstrap failed: %s", exc)
        return False


def get_all_config() -> Dict[str, Any]:
    """Full config for settings UI. Bootstraps if empty when DB is available."""
    if not is_db_available():
        return DEFAULT_CONFIG

    if not ensure_schema():
        return DEFAULT_CONFIG

    try:
        bootstrap_if_empty()
        with _get_engine().connect() as conn:
            providers = conn.execute(
                text("""
                    SELECT id, name, display_name, enabled
                    FROM ai_providers
                    ORDER BY id
                """)
            ).fetchall()
            if not providers:
                return DEFAULT_CONFIG

            models = conn.execute(
                text("""
                    SELECT id, provider_id, display_label, version,
                           provider_native_model_name, enabled, visible,
                           is_default, sort_order
                    FROM ai_models
                    ORDER BY provider_id, sort_order, id
                """)
            ).fetchall()

            models_by_provider: Dict[str, List[Dict[str, Any]]] = {}
            for row in models:
                pid = row._mapping["provider_id"]
                models_by_provider.setdefault(pid, []).append(_row_to_model_entry(row))

            result_providers = []
            for prow in providers:
                pm = dict(prow._mapping)
                pid = pm["id"]
                result_providers.append({
                    "provider_id": pid,
                    "name": pm["display_name"] or pm["name"],
                    "models": models_by_provider.get(pid, []),
                })

            return {"providers": result_providers}
    except Exception as exc:
        logger.warning("[AI_MODEL_STORE] get_all_config failed: %s", exc)
        return DEFAULT_CONFIG


def validate_config(config: Dict[str, Any]) -> List[str]:
    """Return a list of validation error messages (empty if valid)."""
    errors: List[str] = []
    providers = config.get("providers")
    if not isinstance(providers, list) or not providers:
        errors.append("providers must be a non-empty list")
        return errors

    default_count = 0
    seen_model_ids: set[str] = set()

    for provider in providers:
        pid = provider.get("provider_id")
        if pid not in VALID_PROVIDER_IDS:
            errors.append(f"invalid provider_id: {pid!r}")

        models = provider.get("models")
        if not isinstance(models, list):
            errors.append(f"models must be a list for provider {pid!r}")
            continue

        for model in models:
            mid = (model.get("model_id") or "").strip()
            if not mid or not MODEL_ID_PATTERN.match(mid):
                errors.append(f"invalid model_id: {mid!r}")
            elif mid in seen_model_ids:
                errors.append(f"duplicate model_id: {mid}")
            else:
                seen_model_ids.add(mid)

            native = (model.get("provider_native_model_name") or "").strip()
            if not native:
                errors.append(f"provider_native_model_name required for {mid!r}")

            if model.get("is_default") and model.get("enabled"):
                default_count += 1

    if default_count != 1:
        errors.append("exactly one enabled model must be marked is_default")

    return errors


def _apply_config(conn, config: Dict[str, Any]) -> None:
    """Replace full catalog inside an open connection (no commit).

    Upserts every provider/model in ``config`` and then prunes any model
    rows that are no longer present, so this is a true replace: models the
    user deleted in the settings UI are removed rather than left behind.
    """
    sort_idx = 0
    kept_model_ids: List[str] = []
    kept_provider_ids: List[str] = []
    for provider in config["providers"]:
        pid = provider["provider_id"]
        kept_provider_ids.append(pid)
        pname = provider.get("name") or pid
        conn.execute(
            text("""
                INSERT INTO ai_providers (id, name, display_name, enabled)
                VALUES (:id, :name, :display_name, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    display_name = EXCLUDED.display_name,
                    updated_at = NOW()
            """),
            {"id": pid, "name": pname, "display_name": pname},
        )

        for model in provider.get("models", []):
            conn.execute(
                text("""
                    INSERT INTO ai_models (
                        id, provider_id, display_label, version,
                        provider_native_model_name, enabled, visible,
                        is_default, sort_order
                    )
                    VALUES (
                        :id, :provider_id, :display_label, :version,
                        :native, :enabled, :visible, :is_default, :sort_order
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        provider_id = EXCLUDED.provider_id,
                        display_label = EXCLUDED.display_label,
                        version = EXCLUDED.version,
                        provider_native_model_name = EXCLUDED.provider_native_model_name,
                        enabled = EXCLUDED.enabled,
                        visible = EXCLUDED.visible,
                        is_default = EXCLUDED.is_default,
                        sort_order = EXCLUDED.sort_order,
                        updated_at = NOW()
                """),
                {
                    "id": model["model_id"],
                    "provider_id": pid,
                    "display_label": model["display_label"],
                    "version": model.get("version") or "",
                    "native": model["provider_native_model_name"].strip(),
                    "enabled": bool(model.get("enabled")),
                    "visible": bool(model.get("visible")),
                    "is_default": bool(model.get("is_default")),
                    "sort_order": sort_idx,
                },
            )
            kept_model_ids.append(model["model_id"])
            sort_idx += 1

    # Prune models the user removed. Without this, _apply_config would only
    # ever add/update rows, so deletes in the settings UI never persisted.
    if kept_model_ids:
        conn.execute(
            text("DELETE FROM ai_models WHERE id NOT IN :ids").bindparams(
                bindparam("ids", expanding=True)
            ),
            {"ids": kept_model_ids},
        )
    else:
        conn.execute(text("DELETE FROM ai_models"))

    # Prune providers no longer referenced (cascades to any leftover models).
    if kept_provider_ids:
        conn.execute(
            text("DELETE FROM ai_providers WHERE id NOT IN :ids").bindparams(
                bindparam("ids", expanding=True)
            ),
            {"ids": kept_provider_ids},
        )


def replace_config(config: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate and persist full config. Returns (ok, errors)."""
    errors = validate_config(config)
    if errors:
        return False, errors

    if not is_db_available():
        return False, ["Database is not configured"]

    if not ensure_schema():
        return False, ["AI model tables could not be created"]

    try:
        with _get_engine().connect() as conn:
            _apply_config(conn, config)
            conn.commit()
        return True, []
    except Exception as exc:
        logger.exception("[AI_MODEL_STORE] replace_config failed: %s", exc)
        return False, [str(exc)]


def get_runtime_specs() -> Optional[Dict[str, Dict[str, Any]]]:
    """Load all models for provider_registry. None if DB unavailable."""
    if not is_db_available() or not ensure_schema():
        return None

    try:
        bootstrap_if_empty()
        with _get_engine().connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT m.id, m.provider_id, m.display_label,
                           m.provider_native_model_name, m.enabled, m.visible,
                           m.is_default
                    FROM ai_models m
                    JOIN ai_providers p ON p.id = m.provider_id
                    WHERE p.enabled = TRUE
                    ORDER BY m.sort_order, m.id
                """)
            ).fetchall()

            if not rows:
                return None

            specs: Dict[str, Dict[str, Any]] = {}
            for row in rows:
                m = dict(row._mapping)
                pid = m["provider_id"]
                module = PROVIDER_MODULE_MAP.get(pid)
                if not module:
                    continue
                specs[m["id"]] = {
                    "model_id": m["id"],
                    "provider": module,
                    "api_model_name": m["provider_native_model_name"],
                    "display_label": m["display_label"],
                    "provider_display": pid,
                    "enabled": bool(m["enabled"]),
                    "visible": bool(m["visible"]),
                    "is_default": bool(m["is_default"]),
                }
            # Ensure at least one default for resolve_model fallback logic
            if specs and not any(s["is_default"] for s in specs.values()):
                if "gemini-flash" in specs:
                    g = specs["gemini-flash"]
                    specs["gemini-flash"] = {**g, "is_default": True}
            return specs or None
    except Exception as exc:
        logger.warning("[AI_MODEL_STORE] get_runtime_specs failed: %s", exc)
        return None


def update_provider(provider_id: str, *, name: Optional[str] = None) -> bool:
    if not is_db_available():
        return False
    try:
        with _get_engine().connect() as conn:
            conn.execute(
                text("""
                    UPDATE ai_providers
                    SET display_name = COALESCE(:name, display_name),
                        name = COALESCE(:name, name),
                        updated_at = NOW()
                    WHERE id = :id
                """),
                {"id": provider_id, "name": name},
            )
            conn.commit()
        return True
    except Exception:
        return False


def set_default_model(model_id: str) -> bool:
    if not is_db_available():
        return False
    try:
        with _get_engine().connect() as conn:
            conn.execute(text("UPDATE ai_models SET is_default = FALSE"))
            conn.execute(
                text("""
                    UPDATE ai_models SET is_default = TRUE, updated_at = NOW()
                    WHERE id = :id AND enabled = TRUE
                """),
                {"id": model_id},
            )
            conn.commit()
        return True
    except Exception:
        return False
