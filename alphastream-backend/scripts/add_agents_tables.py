#!/usr/bin/env python3
"""One-off migration: create the agents / agent_tools tables and seed the
default agent catalog (financial_advisor + supervisor).

Idempotent: re-running ensures the schema and upserts the default agents.
After running, restart the backend so the agent registry cache reloads.

Usage:
    python scripts/add_agents_tables.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from database import agent_store


def migrate() -> None:
    if not agent_store.is_db_available():
        print("[ERROR] Database is not available (check DATABASE_URL / "
              "USE_SQLITE_FALLBACK). Nothing to migrate.")
        sys.exit(1)

    if not agent_store.ensure_schema():
        print("[ERROR] agents / agent_tools tables could not be ensured.")
        sys.exit(1)
    print("[OK] Ensured agents / agent_tools tables")

    seeded = agent_store.bootstrap_if_empty()
    if seeded:
        print("[OK] Seeded default agent catalog (financial_advisor, supervisor)")
    else:
        # Table already had rows; force-upsert defaults so new fields land.
        from database.chat_store import _get_engine
        with _get_engine().connect() as conn:
            for agent in agent_store.DEFAULT_AGENTS:
                agent_store._upsert_agent(conn, agent)
            conn.commit()
        print("[OK] Upserted default agents into existing catalog")

    specs = agent_store.get_runtime_specs() or {}
    print(f"[OK] Agents in catalog: {sorted(specs.keys())}")
    print("\n[OK] Migration completed. Restart the backend so the agent "
          "registry cache reloads.")


if __name__ == "__main__":
    print("=" * 50)
    print("Create + seed agent catalog")
    print("=" * 50)
    migrate()
