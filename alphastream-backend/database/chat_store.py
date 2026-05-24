"""Persistent chat thread/message storage (Supabase PostgreSQL).

Separate from the market-data ``PostgresDatabaseManager`` because chat
is user-scoped and structurally different from shared market caches.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

from config import DATABASE_URL

logger = logging.getLogger(__name__)

RETENTION_DAYS = 14

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not configured — chat persistence unavailable")
        _engine = create_engine(
            DATABASE_URL,
            poolclass=QueuePool,
            pool_size=3,
            max_overflow=5,
            pool_recycle=1800,
            echo=False,
        )
    return _engine


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _expires_at(from_dt: Optional[datetime] = None) -> datetime:
    return (from_dt or _now()) + timedelta(days=RETENTION_DAYS)


# ── Thread operations ────────────────────────────────────────────────────────


def create_thread(
    user_id: str,
    title: str,
    context_label: Optional[str] = None,
    chat_mode: Optional[str] = None,
    route_path: Optional[str] = None,
) -> Dict[str, Any]:
    now = _now()
    thread_id = str(uuid.uuid4())
    with _get_engine().connect() as conn:
        conn.execute(
            text("""
                INSERT INTO chat_threads (id, user_id, title, context_label, chat_mode, route_path, created_at, updated_at, expires_at)
                VALUES (:id, :user_id, :title, :ctx, :mode, :route, :now, :now, :exp)
            """),
            {
                "id": thread_id,
                "user_id": user_id,
                "title": title,
                "ctx": context_label,
                "mode": chat_mode,
                "route": route_path,
                "now": now,
                "exp": _expires_at(now),
            },
        )
        conn.commit()
    return {
        "id": thread_id,
        "user_id": user_id,
        "title": title,
        "context_label": context_label,
        "chat_mode": chat_mode,
        "route_path": route_path,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }


def list_threads(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    with _get_engine().connect() as conn:
        rows = conn.execute(
            text("""
                SELECT t.id, t.title, t.context_label, t.chat_mode, t.route_path,
                       t.created_at, t.updated_at,
                       (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id) AS message_count
                FROM chat_threads t
                WHERE t.user_id = :uid AND t.expires_at > NOW()
                ORDER BY t.updated_at DESC
                LIMIT :lim
            """),
            {"uid": user_id, "lim": limit},
        )
        return [dict(r._mapping) for r in rows]


def get_thread(thread_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    with _get_engine().connect() as conn:
        row = conn.execute(
            text("""
                SELECT id, user_id, title, context_label, chat_mode, route_path,
                       created_at, updated_at
                FROM chat_threads
                WHERE id = :tid AND user_id = :uid AND expires_at > NOW()
            """),
            {"tid": thread_id, "uid": user_id},
        ).first()
        if not row:
            return None
        thread = dict(row._mapping)

        msgs = conn.execute(
            text("""
                SELECT id, role, content, created_at
                FROM chat_messages
                WHERE thread_id = :tid
                ORDER BY created_at ASC
            """),
            {"tid": thread_id},
        )
        thread["messages"] = [dict(m._mapping) for m in msgs]
        return thread


def delete_thread(thread_id: str, user_id: str) -> bool:
    with _get_engine().connect() as conn:
        result = conn.execute(
            text("DELETE FROM chat_threads WHERE id = :tid AND user_id = :uid"),
            {"tid": thread_id, "uid": user_id},
        )
        conn.commit()
        return result.rowcount > 0


# ── Message operations ───────────────────────────────────────────────────────


def add_message(
    thread_id: str,
    user_id: str,
    role: str,
    content: str,
) -> Optional[Dict[str, Any]]:
    """Append a message and refresh the thread's expiry window."""
    now = _now()
    msg_id = str(uuid.uuid4())

    with _get_engine().connect() as conn:
        owner = conn.execute(
            text("SELECT id FROM chat_threads WHERE id = :tid AND user_id = :uid"),
            {"tid": thread_id, "uid": user_id},
        ).first()
        if not owner:
            return None

        conn.execute(
            text("""
                INSERT INTO chat_messages (id, thread_id, role, content, created_at)
                VALUES (:id, :tid, :role, :content, :now)
            """),
            {"id": msg_id, "tid": thread_id, "role": role, "content": content, "now": now},
        )
        conn.execute(
            text("""
                UPDATE chat_threads
                SET updated_at = :now, expires_at = :exp
                WHERE id = :tid
            """),
            {"now": now, "exp": _expires_at(now), "tid": thread_id},
        )
        conn.commit()

    return {"id": msg_id, "thread_id": thread_id, "role": role, "content": content, "created_at": now.isoformat()}


# ── Retention cleanup ────────────────────────────────────────────────────────


def delete_expired_threads() -> int:
    """Remove threads past their expiry. Returns count deleted."""
    with _get_engine().connect() as conn:
        result = conn.execute(
            text("DELETE FROM chat_threads WHERE expires_at < NOW()")
        )
        conn.commit()
        count = result.rowcount
    if count:
        logger.info("[CHAT_STORE] Deleted %d expired threads", count)
    return count
