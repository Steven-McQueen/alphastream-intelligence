"""
News importer using FMP stable news endpoints with SQLite caching.
"""

from datetime import datetime
from typing import List, Optional

from database.db_manager import db
from services.fmp_client import fmp_client


def _normalize_article(item: dict, ticker_override: Optional[str] = None) -> dict:
    return {
        "ticker": (ticker_override or item.get("symbol") or None),
        "title": item.get("title", ""),
        "url": item.get("url"),
        "published_date": item.get("publishedDate"),
        "snippet": item.get("text", ""),
        "site": item.get("site", ""),
        "publisher": item.get("publisher", ""),
        "image": item.get("image", ""),
    }


def refresh_general_news(limit: int = 50) -> int:
    """Fetch general market news and cache."""
    try:
        articles = fmp_client.get_general_latest_news(page=0, limit=limit)
        normalized = [_normalize_article(a, None) for a in articles]
        inserted = db.upsert_news_articles_bulk(normalized)
        return inserted
    except Exception as exc:
        print(f"[ERROR] General news refresh failed: {exc}")
        return 0


def refresh_stock_latest(limit: int = 100) -> int:
    """Fetch mixed stock news feed and cache."""
    try:
        articles = fmp_client.get_stock_latest_news(page=0, limit=limit)
        normalized = [_normalize_article(a, a.get("symbol")) for a in articles]
        inserted = db.upsert_news_articles_bulk(normalized)
        return inserted
    except Exception as exc:
        print(f"[ERROR] Stock-latest news refresh failed: {exc}")
        return 0


def refresh_ticker_news(symbols: List[str], limit: int = 20) -> int:
    """Fetch news for specific tickers and cache."""
    try:
        articles = fmp_client.get_news_for_symbols(symbols, limit=limit)
        normalized = []
        for a in articles:
            sym = a.get("symbol") or (symbols[0] if symbols else None)
            normalized.append(_normalize_article(a, sym))
        inserted = db.upsert_news_articles_bulk(normalized)
        return inserted
    except Exception as exc:
        print(f"[ERROR] Ticker news refresh failed: {exc}")
        return 0


def prune_old_news(max_age_days: int = 7) -> int:
    """Remove stale news entries."""
    try:
        return db.prune_news(max_age_days)
    except Exception as exc:
        print(f"[ERROR] Prune news failed: {exc}")
        return 0

