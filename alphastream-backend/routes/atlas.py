"""Atlas — system overview endpoints.

  GET /api/atlas/graph   — agent + tool nodes and their relationships
  GET /api/atlas/schema  — curated, read-only database map

Everything here is derived from the live registry (so the Atlas page is always
current for every agent) plus a hand-curated schema map (no raw introspection).
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter

from database import agent_store
from services.chat import tools

router = APIRouter(prefix="/api/atlas")


def _build_graph() -> Dict[str, Any]:
    agents = agent_store.get_all_config().get("agents", [])
    agent_slugs = {a["slug"] for a in agents}
    tool_specs = {s.name: s for s in tools.get_specs()}

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    used_tools: set[str] = set()

    for a in agents:
        nodes.append({
            "id": f"agent:{a['slug']}",
            "type": "agent",
            "data": {
                "slug": a["slug"],
                "name": a["name"],
                "role": a.get("role", "specialist"),
                "grounding_mode": a.get("grounding_mode", "tools"),
                "suggested_model_id": a.get("suggested_model_id"),
                "tools": a.get("tools", []),
                "process_doc": a.get("process_doc", ""),
                "enabled": a.get("enabled", True),
                "visible": a.get("visible", True),
                "is_default": a.get("is_default", False),
            },
        })
        for tool_name in a.get("tools", []):
            if tool_name in agent_slugs:
                # An agent-as-tool handoff (supervisor -> specialist).
                edges.append({
                    "id": f"{a['slug']}->{tool_name}",
                    "source": f"agent:{a['slug']}",
                    "target": f"agent:{tool_name}",
                    "type": "handoff",
                })
            else:
                used_tools.add(tool_name)
                edges.append({
                    "id": f"{a['slug']}->{tool_name}",
                    "source": f"agent:{a['slug']}",
                    "target": f"tool:{tool_name}",
                    "type": "uses",
                })

    for name, spec in tool_specs.items():
        nodes.append({
            "id": f"tool:{name}",
            "type": "tool",
            "data": {
                "name": name,
                "description": spec.description,
                "used": name in used_tools,
            },
        })

    return {"nodes": nodes, "edges": edges}


# Curated, whitelisted database map (no raw introspection of internals).
_SCHEMA: List[Dict[str, Any]] = [
    {"table": "symbols", "purpose": "Master universe of tradable symbols + tier flags",
     "key_columns": ["symbol (PK)", "name", "exchange", "tier"],
     "relationships": ["symbols 1—* stocks", "symbols 1—* price_bars"]},
    {"table": "stocks", "purpose": "Latest quote + fundamentals snapshot per symbol",
     "key_columns": ["ticker (PK)", "price", "market_cap", "pe", "sector"],
     "relationships": ["stocks *—1 symbols"]},
    {"table": "price_bars", "purpose": "OHLCV history",
     "key_columns": ["symbol", "ts", "open", "high", "low", "close", "volume"],
     "relationships": ["price_bars *—1 symbols"]},
    {"table": "market_indices", "purpose": "Index quotes (S&P 500, etc.)",
     "key_columns": ["symbol", "value", "change"], "relationships": []},
    {"table": "macro_indicators", "purpose": "FRED macro series",
     "key_columns": ["series_id", "value", "date"], "relationships": []},
    {"table": "earnings_calendar", "purpose": "Upcoming/past earnings events",
     "key_columns": ["symbol", "date", "eps_est", "eps_actual"],
     "relationships": ["earnings_calendar *—1 symbols"]},
    {"table": "news_articles", "purpose": "Cached news",
     "key_columns": ["id", "symbol", "title", "published_at", "publisher"],
     "relationships": []},
    {"table": "company_profiles", "purpose": "Company profile/description cache",
     "key_columns": ["symbol", "description", "ceo", "industry"],
     "relationships": ["company_profiles *—1 symbols"]},
    {"table": "ai_providers", "purpose": "Chat LLM providers (google/openai/anthropic/...)",
     "key_columns": ["id (PK)", "display_name", "enabled"],
     "relationships": ["ai_providers 1—* ai_models"]},
    {"table": "ai_models", "purpose": "Chat model catalog (editable in Settings)",
     "key_columns": ["id (PK)", "provider_id", "provider_native_model_name", "enabled", "is_default"],
     "relationships": ["ai_models *—1 ai_providers"]},
    {"table": "agents", "purpose": "Agent profiles (persona + grounding mode + model)",
     "key_columns": ["slug (PK)", "persona", "role", "grounding_mode", "suggested_model_id", "is_default"],
     "relationships": ["agents 1—* agent_tools"]},
    {"table": "agent_tools", "purpose": "Which tools each agent may call",
     "key_columns": ["agent_slug", "tool_name"],
     "relationships": ["agent_tools *—1 agents"]},
]


@router.get("/graph")
def get_graph():
    """Agent + tool nodes and their edges, derived from the live registry."""
    return _build_graph()


@router.get("/schema")
def get_schema():
    """Curated database table/relationship map for the overview."""
    return {"tables": _SCHEMA}
