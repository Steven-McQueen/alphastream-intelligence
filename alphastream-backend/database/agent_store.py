"""Persistent agent-profile catalog (Supabase PostgreSQL).

An *agent* is a profile applied to the user's selected model: persona +
context recipe + tool subset + grounding mode. This store is the single
source of truth the registry, slash commands, Settings, and the Atlas page
all read from. Mirrors the shape of ``ai_model_store`` (schema + seed +
runtime load) so the patterns stay consistent.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import bindparam, text

from config import DATABASE_URL, USE_SQLITE_FALLBACK
from database.chat_store import _get_engine

logger = logging.getLogger(__name__)

VALID_GROUNDING_MODES = frozenset({"inject", "tools"})
VALID_ROLES = frozenset({"specialist", "supervisor"})
SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")

# Seed catalog. financial_advisor preserves today's agentic copilot behavior
# (tools mode + the full FMP tool set); supervisor is scaffolding for the
# opt-in orchestration path (batch C) and is hidden from the composer for now.
DEFAULT_AGENTS: List[Dict[str, Any]] = [
    {
        "slug": "financial_advisor",
        "name": "Financial Advisor",
        "persona": (
            "You are the AlphaStream Financial Advisor, a markets-savvy "
            "analyst embedded in the AlphaStream Intelligence Terminal. You "
            "help users understand equities, valuation, fundamentals, and "
            "analyst sentiment with clear, grounded, well-reasoned answers."
        ),
        "role": "specialist",
        "grounding_mode": "tools",
        "suggested_model_id": None,
        "context_sources": [],
        "tools": [
            "search_symbol",
            "get_company_snapshot",
            "get_fundamentals",
            "get_analyst_view",
            "get_recent_news",
            "get_peers",
            "get_financial_statement",
        ],
        "process_doc": (
            "## Financial Advisor\n\n"
            "Answers equity/markets questions grounded in live FMP data.\n\n"
            "- **Grounding:** `tools` — calls FMP tools on demand "
            "(quote/profile, fundamentals, analyst view, news, peers, "
            "statements), resolving company names with `search_symbol`.\n"
            "- **Model:** whichever model the user selected.\n"
            "- **Use when:** any question about a specific company, ticker, "
            "valuation, or analyst sentiment."
        ),
        "enabled": True,
        "visible": True,
        "is_default": True,
        "sort_order": 0,
    },
    {
        "slug": "supervisor",
        "name": "Supervisor (CEO)",
        "persona": (
            "You are the AlphaStream Supervisor. You triage the user's "
            "request, delegate to the most suitable specialist agent, and "
            "synthesize their findings into one coherent answer."
        ),
        "role": "supervisor",
        "grounding_mode": "tools",
        "suggested_model_id": None,
        "context_sources": [],
        "tools": [],  # agent-as-tool handoffs added in batch C (orchestration)
        "process_doc": (
            "## Supervisor (CEO)\n\n"
            "Orchestrator for the opt-in multi-agent path. Routes a request "
            "to specialist agents via agent-as-tool handoffs and synthesizes "
            "the result. **Off by default** — the only multi-LLM-call path."
        ),
        "enabled": True,
        "visible": False,
        "is_default": False,
        "sort_order": 99,
    },
]


def is_db_available() -> bool:
    return bool(DATABASE_URL) and not USE_SQLITE_FALLBACK


_schema_ready = False


def ensure_schema() -> bool:
    """Create agents / agent_tools tables if missing."""
    global _schema_ready
    if _schema_ready or not is_db_available():
        return _schema_ready

    try:
        with _get_engine().connect() as conn:
            conn.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS agents (
                        slug                TEXT PRIMARY KEY,
                        name                TEXT NOT NULL,
                        persona             TEXT NOT NULL,
                        role                TEXT NOT NULL DEFAULT 'specialist',
                        grounding_mode      TEXT NOT NULL DEFAULT 'tools',
                        suggested_model_id  TEXT,
                        context_sources     TEXT NOT NULL DEFAULT '[]',
                        process_doc         TEXT NOT NULL DEFAULT '',
                        enabled             BOOLEAN NOT NULL DEFAULT TRUE,
                        visible             BOOLEAN NOT NULL DEFAULT TRUE,
                        is_default          BOOLEAN NOT NULL DEFAULT FALSE,
                        sort_order          INTEGER NOT NULL DEFAULT 0,
                        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
            )
            conn.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS agent_tools (
                        agent_slug  TEXT NOT NULL
                            REFERENCES agents(slug) ON DELETE CASCADE,
                        tool_name   TEXT NOT NULL,
                        sort_order  INTEGER NOT NULL DEFAULT 0,
                        PRIMARY KEY (agent_slug, tool_name)
                    )
                """)
            )
            conn.commit()
        _schema_ready = True
        logger.info("[AGENT_STORE] Ensured agents / agent_tools tables exist")
        return True
    except Exception as exc:
        logger.warning("[AGENT_STORE] ensure_schema failed: %s", exc)
        return False


def _count_agents(conn) -> int:
    return conn.execute(text("SELECT COUNT(*) FROM agents")).scalar() or 0


def _upsert_agent(conn, agent: Dict[str, Any]) -> None:
    conn.execute(
        text("""
            INSERT INTO agents (
                slug, name, persona, role, grounding_mode, suggested_model_id,
                context_sources, process_doc, enabled, visible, is_default,
                sort_order
            ) VALUES (
                :slug, :name, :persona, :role, :grounding_mode, :suggested_model_id,
                :context_sources, :process_doc, :enabled, :visible, :is_default,
                :sort_order
            )
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                persona = EXCLUDED.persona,
                role = EXCLUDED.role,
                grounding_mode = EXCLUDED.grounding_mode,
                suggested_model_id = EXCLUDED.suggested_model_id,
                context_sources = EXCLUDED.context_sources,
                process_doc = EXCLUDED.process_doc,
                enabled = EXCLUDED.enabled,
                visible = EXCLUDED.visible,
                is_default = EXCLUDED.is_default,
                sort_order = EXCLUDED.sort_order,
                updated_at = NOW()
        """),
        {
            "slug": agent["slug"],
            "name": agent["name"],
            "persona": agent["persona"],
            "role": agent.get("role", "specialist"),
            "grounding_mode": agent.get("grounding_mode", "tools"),
            "suggested_model_id": agent.get("suggested_model_id"),
            "context_sources": json.dumps(agent.get("context_sources", [])),
            "process_doc": agent.get("process_doc", ""),
            "enabled": bool(agent.get("enabled", True)),
            "visible": bool(agent.get("visible", True)),
            "is_default": bool(agent.get("is_default", False)),
            "sort_order": int(agent.get("sort_order", 0)),
        },
    )
    conn.execute(
        text("DELETE FROM agent_tools WHERE agent_slug = :slug"),
        {"slug": agent["slug"]},
    )
    for idx, tool_name in enumerate(agent.get("tools", [])):
        conn.execute(
            text("""
                INSERT INTO agent_tools (agent_slug, tool_name, sort_order)
                VALUES (:slug, :tool, :idx)
                ON CONFLICT (agent_slug, tool_name) DO NOTHING
            """),
            {"slug": agent["slug"], "tool": tool_name, "idx": idx},
        )


def bootstrap_if_empty() -> bool:
    """Insert the default agents when the table is empty. Returns True if seeded."""
    if not is_db_available() or not ensure_schema():
        return False
    try:
        with _get_engine().connect() as conn:
            if _count_agents(conn) > 0:
                return False
            for agent in DEFAULT_AGENTS:
                _upsert_agent(conn, agent)
            conn.commit()
            logger.info("[AGENT_STORE] Seeded default agent catalog")
            return True
    except Exception as exc:
        logger.warning("[AGENT_STORE] Bootstrap failed: %s", exc)
        return False


def _row_to_spec(row: Any, tools: List[str]) -> Dict[str, Any]:
    m = dict(row._mapping)
    try:
        context_sources = json.loads(m.get("context_sources") or "[]")
    except (TypeError, ValueError):
        context_sources = []
    return {
        "slug": m["slug"],
        "name": m["name"],
        "persona": m["persona"],
        "role": m["role"],
        "grounding_mode": m["grounding_mode"],
        "suggested_model_id": m["suggested_model_id"],
        "context_sources": context_sources,
        "tools": tools,
        "process_doc": m["process_doc"] or "",
        "enabled": bool(m["enabled"]),
        "visible": bool(m["visible"]),
        "is_default": bool(m["is_default"]),
        "sort_order": m["sort_order"],
    }


def get_runtime_specs() -> Optional[Dict[str, Dict[str, Any]]]:
    """Load all agents (keyed by slug) for the registry. None if DB unavailable."""
    if not is_db_available() or not ensure_schema():
        return None
    try:
        bootstrap_if_empty()
        with _get_engine().connect() as conn:
            agent_rows = conn.execute(
                text("""
                    SELECT slug, name, persona, role, grounding_mode,
                           suggested_model_id, context_sources, process_doc,
                           enabled, visible, is_default, sort_order
                    FROM agents
                    ORDER BY sort_order, slug
                """)
            ).fetchall()
            if not agent_rows:
                return None

            tool_rows = conn.execute(
                text("""
                    SELECT agent_slug, tool_name
                    FROM agent_tools
                    ORDER BY agent_slug, sort_order
                """)
            ).fetchall()
            tools_by_agent: Dict[str, List[str]] = {}
            for tr in tool_rows:
                tm = dict(tr._mapping)
                tools_by_agent.setdefault(tm["agent_slug"], []).append(tm["tool_name"])

            return {
                row._mapping["slug"]: _row_to_spec(
                    row, tools_by_agent.get(row._mapping["slug"], [])
                )
                for row in agent_rows
            }
    except Exception as exc:
        logger.warning("[AGENT_STORE] get_runtime_specs failed: %s", exc)
        return None


def get_all_config() -> Dict[str, Any]:
    """Full agent catalog for the Settings UI / Atlas. Bootstraps if empty."""
    specs = get_runtime_specs()
    if specs is None:
        return {"agents": DEFAULT_AGENTS}
    return {"agents": list(specs.values())}


def validate_config(config: Dict[str, Any], known_tools: Optional[set] = None) -> List[str]:
    """Return validation error messages (empty if valid)."""
    errors: List[str] = []
    agents = config.get("agents")
    if not isinstance(agents, list) or not agents:
        errors.append("agents must be a non-empty list")
        return errors

    seen: set[str] = set()
    enabled_visible_defaults = 0
    for agent in agents:
        slug = (agent.get("slug") or "").strip()
        if not slug or not SLUG_PATTERN.match(slug):
            errors.append(f"invalid slug: {slug!r} (lowercase, digits, _ and -)")
        elif slug in seen:
            errors.append(f"duplicate slug: {slug}")
        else:
            seen.add(slug)

        if not (agent.get("name") or "").strip():
            errors.append(f"name required for {slug!r}")
        if not (agent.get("persona") or "").strip():
            errors.append(f"persona required for {slug!r}")
        if agent.get("grounding_mode") not in VALID_GROUNDING_MODES:
            errors.append(f"invalid grounding_mode for {slug!r}")
        if agent.get("role", "specialist") not in VALID_ROLES:
            errors.append(f"invalid role for {slug!r}")

        for tool_name in agent.get("tools", []) or []:
            if known_tools is not None and tool_name not in known_tools:
                errors.append(f"unknown tool {tool_name!r} on {slug!r}")

        if agent.get("is_default") and agent.get("enabled") and agent.get("visible"):
            enabled_visible_defaults += 1

    if enabled_visible_defaults != 1:
        errors.append("exactly one enabled+visible agent must be is_default")

    return errors


def replace_config(
    config: Dict[str, Any], known_tools: Optional[set] = None
) -> Tuple[bool, List[str]]:
    """Validate and persist the full agent catalog. Returns (ok, errors)."""
    errors = validate_config(config, known_tools)
    if errors:
        return False, errors
    if not is_db_available():
        return False, ["Database is not configured"]
    if not ensure_schema():
        return False, ["Agent tables could not be created"]

    try:
        slugs = [a["slug"] for a in config["agents"]]
        with _get_engine().connect() as conn:
            for agent in config["agents"]:
                _upsert_agent(conn, agent)
            # Prune agents removed in the UI (true replace).
            conn.execute(
                text("DELETE FROM agents WHERE slug NOT IN :slugs").bindparams(
                    bindparam("slugs", expanding=True)
                ),
                {"slugs": slugs},
            )
            conn.commit()
        return True, []
    except Exception as exc:
        logger.exception("[AGENT_STORE] replace_config failed: %s", exc)
        return False, [str(exc)]
