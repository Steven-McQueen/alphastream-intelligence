"""News endpoints (/api/news/*)."""

from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from models import MarketNewsItem
from services.news_importer import refresh_general_news, refresh_newsapi_categories, refresh_ticker_news

router = APIRouter(prefix="/api/news")


def _news_row_to_item(row: dict, category: str, tickers: List[str]) -> MarketNewsItem:
    return MarketNewsItem(
        id=row.get("url") or row.get("title", ""),
        headline=row.get("title", ""),
        summary=row.get("snippet", ""),
        source=row.get("site", ""),
        publishedAt=row.get("published_date") or datetime.now().isoformat(),
        category=category,
        sentiment="neutral",
        tickers=tickers,
        url=row.get("url"),
    )


def _news_row_to_rich(row: dict) -> dict:
    return {
        "id": row.get("url") or row.get("title", ""),
        "headline": row.get("title", ""),
        "summary": row.get("snippet", ""),
        "source": row.get("publisher") or row.get("site") or "",
        "publishedAt": row.get("published_date") or datetime.now().isoformat(),
        "category": row.get("category") or "general",
        "sentiment": "neutral",
        "tickers": [row.get("ticker")] if row.get("ticker") else [],
        "url": row.get("url", ""),
        "image": row.get("image", ""),
        "site": row.get("site", ""),
        "author": row.get("author", ""),
    }


@router.get("", response_model=List[MarketNewsItem])
def news(category: str = "general"):
    try:
        articles = db.get_news_general(limit=20)
        if not articles:
            refresh_general_news(limit=50)
            articles = db.get_news_general(limit=20)
        return [_news_row_to_item(row, category="general", tickers=[]) for row in articles]
    except Exception as exc:
        print(f"Error in news: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/general")
def general_news(limit: int = 20):
    """Backward-compatible general news endpoint (cached merged feed)."""
    try:
        articles = db.get_news_by_category("all", limit=limit)
        if not articles:
            refresh_general_news(limit=150)
            refresh_newsapi_categories(per_category_limit=40)
            articles = db.get_news_by_category("all", limit=limit)
        return [_news_row_to_rich(row) for row in articles]
    except Exception as exc:
        print(f"Error in general_news: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/feed")
def newsroom_feed(category: str = "all", limit: int = 60):
    """Category-aware newsroom feed (merged FMP + NewsAPI cache)."""
    try:
        safe_limit = max(1, min(limit, 200))
        normalized_category = (category or "all").lower()
        rows = db.get_news_by_category(normalized_category, limit=safe_limit)
        if not rows:
            refresh_general_news(limit=150)
            refresh_newsapi_categories(per_category_limit=40)
            rows = db.get_news_by_category(normalized_category, limit=safe_limit)
        return [_news_row_to_rich(row) for row in rows]
    except Exception as exc:
        print(f"Error in newsroom_feed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}")
def company_news(ticker: str):
    """Get news for a specific ticker."""
    try:
        symbol = ticker.upper()
        articles = db.get_news_for_ticker(symbol, limit=20)
        if not articles:
            refresh_ticker_news([symbol], limit=20)
            articles = db.get_news_for_ticker(symbol, limit=20)

        return [
            {
                "symbol": symbol,
                "publishedDate": row.get("published_date") or "",
                "publisher": row.get("publisher") or row.get("site") or "",
                "title": row.get("title") or "",
                "image": row.get("image") or "",
                "site": row.get("site") or "",
                "text": row.get("snippet") or "",
                "url": row.get("url") or "",
            }
            for row in articles
        ]
    except Exception as exc:
        print(f"Error in company_news: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
