"""Supabase JWT validation for user-scoped endpoints.

Usage as a FastAPI dependency::

    from middleware.supabase_auth import get_current_user_id

    @router.get("/my-stuff")
    async def my_stuff(user_id: str = Depends(get_current_user_id)):
        ...
"""

from __future__ import annotations

import logging

import jwt
from fastapi import HTTPException, Request

from config import SUPABASE_JWT_SECRET

logger = logging.getLogger(__name__)


async def get_current_user_id(request: Request) -> str:
    """Extract ``user_id`` (UUID) from a Supabase access-token JWT.

    Expects ``Authorization: Bearer <token>`` header.
    """
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Auth is not configured (SUPABASE_JWT_SECRET missing)",
        )

    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = auth_header[7:]

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        logger.warning("[AUTH] Invalid JWT: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user identity")

    return user_id
