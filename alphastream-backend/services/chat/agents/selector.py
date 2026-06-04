"""Auto-agent selection.

When the user leaves the composer on "Auto", this picks which agent profile
handles the turn. Deliberately a *cheap* step — keyword/heuristic routing, no
extra LLM call — so "auto" never doubles the cost of a request. As specialists
are added (news_scanner, quant_explainer, …) extend ``_ROUTING_RULES``; a tiny
classifier model can slot in here later if heuristics prove insufficient.
"""

from __future__ import annotations

import logging
from typing import List, Optional, Set, Tuple

from services.chat.agents import registry

logger = logging.getLogger(__name__)

# (agent_slug, trigger keywords). First rule whose agent is available and whose
# keyword appears in the message wins; otherwise the default agent is used.
_ROUTING_RULES: List[Tuple[str, Set[str]]] = [
    ("news_scanner", {
        "news", "headline", "headlines", "breaking", "latest", "article",
        "story", "happening", "developments", "announced", "announcement",
    }),
    ("quant_explainer", {
        "explain", "definition", "define", "formula", "sharpe", "beta",
        "volatility", "std dev", "standard deviation", "correlation",
        "intuition behind", "how is it calculated", "how do you calculate",
    }),
]


def select_agent(message: str, context_label: Optional[str] = None) -> str:
    """Return the slug of the agent that should handle this turn."""
    text = (message or "").lower()
    available = {a["slug"] for a in registry.list_agents()}

    for slug, keywords in _ROUTING_RULES:
        if slug in available and any(k in text for k in keywords):
            logger.info("[SELECTOR] auto -> %s (keyword match)", slug)
            return slug

    default = registry.get_default_agent().slug
    logger.info("[SELECTOR] auto -> %s (default)", default)
    return default
