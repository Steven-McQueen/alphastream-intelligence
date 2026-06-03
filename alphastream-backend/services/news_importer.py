"""
News importer using FMP stable news endpoints with SQLite caching.
"""

from datetime import datetime
from typing import List, Optional

from database.db_manager import db
from services.fmp_client import fmp_client
from services.newsapi_client import newsapi_client


NEWS_CATEGORY_QUERIES = {
    "markets": '("stock market" OR equities OR "S&P 500" OR nasdaq OR "dow jones" OR "market rally" OR "market selloff")',
    "economy": "(inflation OR \"federal reserve\" OR \"interest rates\" OR gdp OR recession OR unemployment OR jobs)",
    "earnings": "(earnings OR guidance OR \"quarterly results\" OR revenue OR profit)",
    "tech": "(technology OR \"artificial intelligence\" OR semiconductors OR software OR chipmaker)",
    "crypto": "(bitcoin OR ethereum OR crypto OR blockchain OR coinbase)",
    "geopolitics": "(trade OR tariffs OR sanctions OR geopolitics OR \"central bank\" OR election)",
}

# Keyword heuristics so every article lands in a meaningful section.
_CATEGORY_KEYWORDS = [
    ("crypto", ("bitcoin", "ethereum", "crypto", "blockchain", "coinbase", "btc", "ether", "stablecoin", "token")),
    ("earnings", ("earnings", "quarterly results", "eps", "guidance", "revenue", "profit", "beats estimates", "misses estimates", "q1", "q2", "q3", "q4", "fiscal")),
    ("economy", ("inflation", "federal reserve", "the fed", "interest rate", "gdp", "jobless", "unemployment", "payroll", "cpi", "ppi", "treasury", "recession", "rate cut", "rate hike", "economy")),
    ("crypto", ("dogecoin", "solana", "ripple", "xrp")),
    ("tech", ("artificial intelligence", " ai ", "semiconductor", "chipmaker", "software", "cloud", "nvidia", "microsoft", "apple", "google", "openai", "data center", "tech ")),
    ("geopolitics", ("tariff", "sanction", "geopolit", "trade war", "election", "war", "conflict", "opec", "central bank")),
    ("markets", ("s&p 500", "nasdaq", "dow jones", "stock market", "equities", "wall street", "shares", "rally", "selloff", "futures", "index", "etf", "bond yield")),
]


def _classify_category(title: str, snippet: str) -> str:
    """Heuristically bucket an article into a newsroom category."""
    text = f" {(title or '').lower()} {(snippet or '').lower()} "
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(keyword in text for keyword in keywords):
            return category
    return "markets"


def _normalize_article(
    item: dict,
    ticker_override: Optional[str] = None,
    category: str = "auto",
    source_api: str = "fmp",
    force_general: bool = False,
) -> dict:
    source_name = item.get("publisher") or item.get("site") or ""
    if not source_name and isinstance(item.get("source"), dict):
        source_name = item.get("source", {}).get("name", "")

    title = item.get("title", "") or ""
    snippet = item.get("text") or item.get("description") or item.get("content") or ""

    resolved_category = category
    if category == "auto":
        resolved_category = _classify_category(title, snippet)

    if force_general:
        ticker = None
    else:
        ticker = ticker_override or item.get("symbol") or None

    return {
        "ticker": ticker,
        "title": title[:500],
        "url": item.get("url"),
        "published_date": item.get("publishedDate") or item.get("publishedAt"),
        "snippet": snippet[:1000],
        "site": item.get("site") or source_name,
        "publisher": source_name,
        "image": item.get("image") or item.get("urlToImage") or "",
        "category": resolved_category,
        "author": item.get("author", ""),
        "source_api": source_api,
    }


def refresh_general_news(limit: int = 150) -> int:
    """Fetch general market news (multi-page) and cache as the broad feed."""
    try:
        per_page = 100
        pages = max(1, (limit + per_page - 1) // per_page)
        articles: List[dict] = []
        for page in range(pages):
            batch = fmp_client.get_general_latest_news(page=page, limit=per_page)
            if not batch:
                break
            articles.extend(batch)
        # Classify per article; keep these ticker-agnostic so they anchor the feed.
        normalized = [
            _normalize_article(a, None, category="auto", source_api="fmp", force_general=True)
            for a in articles
        ]
        inserted = db.upsert_news_articles_bulk(normalized)
        return inserted
    except Exception as exc:
        print(f"[ERROR] General news refresh failed: {exc}")
        return 0


def refresh_stock_latest(limit: int = 200) -> int:
    """Fetch mixed stock news feed (multi-page) and cache."""
    try:
        per_page = 100
        pages = max(1, (limit + per_page - 1) // per_page)
        articles: List[dict] = []
        for page in range(pages):
            batch = fmp_client.get_stock_latest_news(page=page, limit=per_page)
            if not batch:
                break
            articles.extend(batch)
        normalized = [
            _normalize_article(a, a.get("symbol"), category="auto", source_api="fmp")
            for a in articles
        ]
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
            normalized.append(_normalize_article(a, sym, category="auto", source_api="fmp"))
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


def refresh_newsapi_categories(per_category_limit: int = 40) -> int:
    """Fetch NewsAPI categories and cache for newsroom views."""
    if not newsapi_client.api_key:
        return 0

    normalized = []

    try:
        # Broad US business headlines anchor the feed (auto-classified for sections).
        top_headlines = newsapi_client.get_top_headlines(
            category="business",
            country="us",
            page_size=100,
        )
        normalized.extend(
            _normalize_article(article, None, category="auto", source_api="newsapi", force_general=True)
            for article in top_headlines
            if article.get("url")
        )

        # Per-category editorial coverage. No domain restriction so the free tier
        # returns far more diverse, high-quality results.
        for category, query in NEWS_CATEGORY_QUERIES.items():
            articles = newsapi_client.get_everything(
                q=query,
                page_size=per_category_limit,
                sort_by="publishedAt",
            )
            normalized.extend(
                _normalize_article(article, None, category=category, source_api="newsapi", force_general=True)
                for article in articles
                if article.get("url")
            )

        if not normalized:
            return 0
        return db.upsert_news_articles_bulk(normalized)
    except Exception as exc:
        print(f"[ERROR] NewsAPI category refresh failed: {exc}")
        return 0

