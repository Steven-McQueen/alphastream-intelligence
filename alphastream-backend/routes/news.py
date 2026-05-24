"""News endpoints (/api/news/*)."""

from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from models import MarketNewsItem
from services.fmp_client import fmp_client
from services.news_importer import refresh_general_news, refresh_ticker_news

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
    """Get general latest market news from FMP API."""
    try:
        print(f"[DATA] Fetching general news, limit={limit}")
        articles = fmp_client.get_general_latest_news(page=0, limit=limit)
        if not articles:
            print("[WARN] No general news returned from FMP")
            return []

        # Debug: log first article keys to verify image field presence
        if articles:
            print(f"[DATA] First article keys: {list(articles[0].keys())}")
            print(f"[DATA] First article image: {articles[0].get('image', 'NO IMAGE KEY')}")

        result = []
        for article in articles:
            # FMP may use different field names across endpoints
            image = (
                article.get("image")
                or article.get("imageUrl")
                or article.get("banner_image")
                or article.get("thumbnail")
                or ""
            )
            result.append({
                "id": article.get("url") or article.get("title", ""),
                "headline": article.get("title", ""),
                "summary": article.get("text", "")[:200],
                "source": article.get("publisher", ""),
                "publishedAt": article.get("publishedDate", ""),
                "category": "general",
                "sentiment": "neutral",
                "tickers": [],
                "url": article.get("url", ""),
                "image": image,
                "site": article.get("site", ""),
            })
        return result
    except Exception as exc:
        print(f"Error in general_news: {exc}")
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
