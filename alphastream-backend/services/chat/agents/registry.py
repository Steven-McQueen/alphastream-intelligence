"""Agent-profile registry and resolution.

An agent is a *profile* — persona + context recipe + tool subset + grounding
mode — applied to the model the user selected. Loads enabled profiles from the
persisted DB catalog with an in-memory cache; falls back to a static seed when
the DB is unavailable. Same pattern as ``provider_registry``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_AGENT_SLUG = "financial_advisor"


@dataclass(frozen=True)
class AgentSpec:
    """Resolved agent profile used by chat_service for dispatch."""

    slug: str
    name: str
    persona: str
    role: str = "specialist"            # specialist | supervisor
    grounding_mode: str = "tools"       # inject | tools
    tool_names: Tuple[str, ...] = ()
    context_sources: Tuple[Any, ...] = ()
    suggested_model_id: Optional[str] = None
    process_doc: str = ""
    enabled: bool = True
    visible: bool = True
    is_default: bool = False
    sort_order: int = 0


# Static fallback (used only when the DB is unavailable). Mirrors
# agent_store.DEFAULT_AGENTS for the everyday financial_advisor profile.
_STATIC_AGENTS: Dict[str, AgentSpec] = {
    "financial_advisor": AgentSpec(
        slug="financial_advisor",
        name="Financial Advisor",
        persona=(
            "You are the AlphaStream Financial Advisor, a markets-savvy "
            "analyst embedded in the AlphaStream Intelligence Terminal. You "
            "help users understand equities, valuation, fundamentals, and "
            "analyst sentiment with clear, grounded, well-reasoned answers."
        ),
        role="specialist",
        grounding_mode="tools",
        tool_names=(
            "search_symbol",
            "get_company_snapshot",
            "get_fundamentals",
            "get_analyst_view",
            "get_recent_news",
            "get_peers",
            "get_financial_statement",
        ),
        process_doc="Answers equity/markets questions grounded in live FMP data.",
        enabled=True,
        visible=True,
        is_default=True,
        sort_order=0,
    ),
}

_runtime_cache: Optional[Dict[str, AgentSpec]] = None


def invalidate_cache() -> None:
    """Clear cached DB agents (call after PUT /api/agents)."""
    global _runtime_cache
    _runtime_cache = None


def _spec_from_row(row: Dict[str, Any]) -> AgentSpec:
    return AgentSpec(
        slug=row["slug"],
        name=row["name"],
        persona=row["persona"],
        role=row.get("role", "specialist"),
        grounding_mode=row.get("grounding_mode", "tools"),
        tool_names=tuple(row.get("tools", ()) or ()),
        context_sources=tuple(row.get("context_sources", ()) or ()),
        suggested_model_id=row.get("suggested_model_id"),
        process_doc=row.get("process_doc", "") or "",
        enabled=bool(row.get("enabled", True)),
        visible=bool(row.get("visible", True)),
        is_default=bool(row.get("is_default", False)),
        sort_order=int(row.get("sort_order", 0)),
    )


def _load_runtime_agents() -> Dict[str, AgentSpec]:
    global _runtime_cache
    if _runtime_cache is not None:
        return _runtime_cache

    agents: Dict[str, AgentSpec] = dict(_STATIC_AGENTS)
    try:
        from database.agent_store import get_runtime_specs

        db_specs = get_runtime_specs()
        if db_specs:
            agents = {slug: _spec_from_row(row) for slug, row in db_specs.items()}
    except Exception as exc:
        logger.warning("[AGENT_REGISTRY] DB load failed, using static fallback: %s", exc)

    _runtime_cache = agents
    return agents


def _get_agents() -> Dict[str, AgentSpec]:
    return _load_runtime_agents()


def resolve_agent(slug: Optional[str]) -> AgentSpec:
    """Resolve ``slug`` to an enabled AgentSpec; fall back to the default."""
    agents = _get_agents()
    if slug:
        spec = agents.get(slug)
        if spec is not None and spec.enabled:
            return spec
    default = _get_default_agent(agents)
    if default is not None:
        return default
    return _STATIC_AGENTS[DEFAULT_AGENT_SLUG]


def _get_default_agent(agents: Dict[str, AgentSpec]) -> Optional[AgentSpec]:
    for spec in agents.values():
        if spec.is_default and spec.enabled:
            return spec
    fa = agents.get(DEFAULT_AGENT_SLUG)
    if fa is not None and fa.enabled:
        return fa
    for spec in agents.values():
        if spec.enabled and spec.visible:
            return spec
    return None


def get_default_agent() -> AgentSpec:
    return resolve_agent(None)


def list_agents(include_hidden: bool = False) -> List[Dict[str, str]]:
    """Agents for the composer/slash menu: enabled (+ visible unless hidden)."""
    out: List[Dict[str, str]] = []
    for spec in sorted(_get_agents().values(), key=lambda s: (s.sort_order, s.slug)):
        if not spec.enabled:
            continue
        if not spec.visible and not include_hidden:
            continue
        out.append({
            "slug": spec.slug,
            "name": spec.name,
            "role": spec.role,
            "grounding_mode": spec.grounding_mode,
        })
    return out
