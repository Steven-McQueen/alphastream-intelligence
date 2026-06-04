"""Agent endpoints.

  GET  /api/agents          — public list for the composer/Atlas
  GET  /api/agents/config   — full catalog for the Settings UI (auth)
  PUT  /api/agents/config   — replace the catalog (auth)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import agent_store
from middleware.supabase_auth import get_current_user_id
from services.chat import tools
from services.chat.agents.registry import (
    get_default_agent,
    invalidate_cache,
    list_agents,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


class AgentConfigBody(BaseModel):
    slug: str
    name: str
    persona: str
    role: str = "specialist"
    grounding_mode: str = "tools"
    suggested_model_id: Optional[str] = None
    context_sources: List[Any] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    process_doc: str = ""
    enabled: bool = True
    visible: bool = True
    is_default: bool = False
    sort_order: int = 0


class AgentsConfigBody(BaseModel):
    agents: List[AgentConfigBody]


@router.get("/agents")
def get_agents():
    """List selectable agent profiles, plus the default slug."""
    return {"agents": list_agents(), "default": get_default_agent().slug}


@router.get("/agents/config")
async def get_agents_config(_user_id: str = Depends(get_current_user_id)):
    """Full agent catalog for the Settings UI."""
    return agent_store.get_all_config()


@router.put("/agents/config")
async def put_agents_config(
    body: AgentsConfigBody,
    _user_id: str = Depends(get_current_user_id),
):
    """Replace the persisted agent catalog; validates structure + tools."""
    config: Dict[str, Any] = {"agents": [a.model_dump() for a in body.agents]}
    known_tools = {s.name for s in tools.get_specs()}
    ok, errors = agent_store.replace_config(config, known_tools)
    if not ok:
        raise HTTPException(status_code=422, detail={"errors": errors})
    invalidate_cache()
    return agent_store.get_all_config()
