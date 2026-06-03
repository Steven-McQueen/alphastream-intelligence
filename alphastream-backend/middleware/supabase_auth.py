"""Supabase JWT validation for user-scoped endpoints.

Primary method: verify the access token by calling the Supabase Auth API.
Fallback: local HS256 decode with SUPABASE_JWT_SECRET (if configured).

Usage as a FastAPI dependency::

    from middleware.supabase_auth import get_current_user_id

    @router.get("/my-stuff")
    async def my_stuff(user_id: str = Depends(get_current_user_id)):
        ...
"""

from __future__ import annotations

import logging
import time

import aiohttp
from fastapi import HTTPException, Request

from config import SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, SUPABASE_URL

logger = logging.getLogger(__name__)

_http_session: aiohttp.ClientSession | None = None

# Short-lived in-memory cache of validated tokens.  The Supabase Auth API
# remains the source of truth; this only avoids re-validating the same bearer
# token on every request within a small window.  Maps token -> (user_id, expiry).
_TOKEN_CACHE_TTL_SECONDS = 90
_token_cache: dict[str, tuple[str, float]] = {}


async def _get_http_session() -> aiohttp.ClientSession:
    global _http_session
    if _http_session is None or _http_session.closed:
        _http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10),
        )
    return _http_session


def _extract_bearer(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    return auth_header[7:]


def _cache_get(token: str) -> str | None:
    entry = _token_cache.get(token)
    if entry is None:
        return None
    user_id, expiry = entry
    if expiry < time.monotonic():
        _token_cache.pop(token, None)
        return None
    return user_id


def _cache_put(token: str, user_id: str) -> None:
    _token_cache[token] = (user_id, time.monotonic() + _TOKEN_CACHE_TTL_SECONDS)


async def _verify_via_supabase_api(token: str) -> str:
    """Call GET /auth/v1/user on the Supabase Auth project to validate the token.

    Validated tokens are cached for ``_TOKEN_CACHE_TTL_SECONDS`` to avoid an
    HTTP round-trip on every authenticated request.
    """
    cached = _cache_get(token)
    if cached is not None:
        return cached

    session = await _get_http_session()
    async with session.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY,
        },
    ) as resp:
        if resp.status in (401, 403):
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        if resp.status != 200:
            body = await resp.text()
            logger.error("[AUTH] Supabase /auth/v1/user returned %s: %s", resp.status, body)
            raise HTTPException(status_code=502, detail="Auth service error")
        data = await resp.json()

    user_id = data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user identity")
    _cache_put(token, user_id)
    return user_id


async def _verify_via_jwt_secret(token: str) -> str:
    """Decode the JWT locally using the shared HS256 secret."""
    import jwt

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


async def get_current_user_id(request: Request) -> str:
    """Extract ``user_id`` (UUID) from a Supabase access-token.

    Prefers the Supabase Auth API (no shared secret needed).
    Falls back to local HS256 decode if SUPABASE_URL is not set.
    """
    token = _extract_bearer(request)

    if SUPABASE_URL and SUPABASE_ANON_KEY:
        return await _verify_via_supabase_api(token)

    if SUPABASE_JWT_SECRET:
        return await _verify_via_jwt_secret(token)

    raise HTTPException(
        status_code=503,
        detail="Auth is not configured (set SUPABASE_URL+SUPABASE_ANON_KEY or SUPABASE_JWT_SECRET)",
    )
