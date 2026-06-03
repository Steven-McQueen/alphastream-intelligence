#!/usr/bin/env python3
"""One-off migration: add the DeepSeek provider + deepseek-v4-pro model.

The AI model catalog is seeded into Postgres only when the tables are empty
(see ai_model_store.bootstrap_if_empty). Databases that were seeded before
DeepSeek existed therefore won't contain it. This script inserts just the
DeepSeek rows into the existing catalog without disturbing anything else.

Idempotent: re-running it upserts the same rows. After running, restart the
backend (or trigger a PUT /api/ai-config) so the in-memory registry cache
picks up the new model.

Usage:
    python scripts/add_deepseek_model.py
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from database.ai_model_store import _get_engine, ensure_schema, is_db_available

PROVIDER = {
    "id": "deepseek",
    "name": "DeepSeek",
}

MODEL = {
    "id": "deepseek-v4-pro",
    "provider_id": "deepseek",
    "display_label": "DeepSeek V4 Pro",
    "version": "v4-pro",
    "native": "deepseek-v4-pro",
    "enabled": True,
    "visible": True,
    "is_default": False,
}


def migrate() -> None:
    if not is_db_available():
        print("[ERROR] Database is not available (check DATABASE_URL / "
              "USE_SQLITE_FALLBACK). Nothing to migrate.")
        sys.exit(1)

    if not ensure_schema():
        print("[ERROR] ai_providers / ai_models tables could not be ensured.")
        sys.exit(1)

    with _get_engine().connect() as conn:
        # Upsert the provider row.
        conn.execute(
            text("""
                INSERT INTO ai_providers (id, name, display_name, enabled)
                VALUES (:id, :name, :name, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    display_name = EXCLUDED.display_name,
                    updated_at = NOW()
            """),
            PROVIDER,
        )
        print(f"[OK] Provider '{PROVIDER['id']}' ensured")

        # Append after existing models so it sorts last in the catalog.
        next_sort = conn.execute(
            text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ai_models")
        ).scalar() or 0

        # Upsert the model row. is_default is left FALSE so the existing
        # default (Gemini) is untouched.
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
                    updated_at = NOW()
            """),
            {**MODEL, "sort_order": next_sort},
        )
        conn.commit()
        print(f"[OK] Model '{MODEL['id']}' ({MODEL['native']}) ensured "
              f"(enabled={MODEL['enabled']}, visible={MODEL['visible']}, "
              f"sort_order={next_sort})")

    print("\n[OK] Migration completed. Restart the backend so the model "
          "registry cache reloads.")


if __name__ == "__main__":
    print("=" * 50)
    print("Add DeepSeek model to AI catalog")
    print("=" * 50)
    migrate()
