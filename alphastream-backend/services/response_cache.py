"""Lightweight in-process TTL cache for hot, globally-shared read endpoints.

Collapses many client polls into a single database read per TTL window, which
cuts Supabase egress and database load. Intended only for responses that are
the same for all users (market movers, sectors, general news, etc.) — never for
user-scoped data.

Usage:
    from services.response_cache import ttl_cache

    @router.get("/top-movers")
    @ttl_cache(seconds=30)
    def get_top_movers(limit: int = 10):
        ...
"""

import functools
import inspect
import threading
import time
from typing import Callable

# key -> (expires_at_monotonic, value)
_store: dict = {}
_lock = threading.Lock()


def _cache_key(fn: Callable, args: tuple, kwargs: dict) -> tuple:
    return (fn.__module__, fn.__qualname__, args, tuple(sorted(kwargs.items())))


def ttl_cache(seconds: float) -> Callable:
    """Cache a function's return value per-argument for ``seconds``.

    Works on both sync and async functions. Exceptions are never cached.
    Arguments must be hashable (the FastAPI query params used by our cached
    endpoints are plain str/int, so this holds).
    """

    def decorator(fn: Callable) -> Callable:
        if inspect.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs):
                key = _cache_key(fn, args, kwargs)
                now = time.monotonic()

                with _lock:
                    cached = _store.get(key)
                    if cached is not None and cached[0] > now:
                        return cached[1]

                value = await fn(*args, **kwargs)

                with _lock:
                    _store[key] = (now + seconds, value)
                return value

            return async_wrapper

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = _cache_key(fn, args, kwargs)
            now = time.monotonic()

            with _lock:
                cached = _store.get(key)
                if cached is not None and cached[0] > now:
                    return cached[1]

            # Compute outside the lock so a slow upstream call doesn't block
            # other cache readers.
            value = fn(*args, **kwargs)

            with _lock:
                _store[key] = (now + seconds, value)
            return value

        return wrapper

    return decorator


def clear_cache() -> None:
    """Drop all cached entries (useful for tests or manual invalidation)."""
    with _lock:
        _store.clear()
