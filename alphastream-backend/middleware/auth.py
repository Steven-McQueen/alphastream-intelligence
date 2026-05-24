"""
Admin API-key guard for data-mutation endpoints.

Usage in a route module:
    from middleware.auth import require_admin
    router = APIRouter(dependencies=[Depends(require_admin)])
    # — or per-route —
    @router.post("/foo", dependencies=[Depends(require_admin)])
"""

import os
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

_ADMIN_KEY: str = os.getenv("ADMIN_API_KEY", "")


def require_admin(key: str = Security(_header)) -> None:
    """Raise 403 if the caller does not supply a valid admin key."""
    if not _ADMIN_KEY:
        # No key configured — block all admin requests in production
        raise HTTPException(status_code=503, detail="Admin endpoints are disabled (no ADMIN_API_KEY set)")
    if not key or key != _ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing admin API key")
