"""Earnings calendar and per-stock earnings endpoints (/api/earnings/*)."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from config import GEMINI_API_KEY
from database.db_manager import db
from services.fmp_client import fmp_client
from services.earnings_importer import refresh_earnings_window
from services.earnings_summary_generator import (
    generate_earnings_summary,
    get_earnings_summary_response,
    get_last_generation_error,
    get_or_generate_earnings_summary,
)
from services.response_cache import ttl_cache

router = APIRouter(prefix="/api/earnings")


def _normalize_ticker_dot_hyphen(t: str) -> str:
    return t.replace(".", "-").upper()


@ttl_cache(seconds=600)
def _ticker_name_map() -> dict:
    """Ticker -> company name lookup (ticker+name only, not full stock rows)."""
    try:
        return db.get_ticker_name_map()
    except Exception as exc:
        print(f"[EARNINGS] Name map unavailable: {exc}")
        return {}


def _next_friday(start_date) -> "datetime.date":
    days_ahead = (4 - start_date.weekday()) % 7
    return start_date + timedelta(days=days_ahead)


@router.get("/calendar")
@ttl_cache(seconds=300)
def get_earnings_calendar_range(from_date: str = None, to_date: str = None, limit: int = 500):
    """Get earnings calendar for a date range."""
    try:
        today = datetime.now().date()
        if not from_date:
            from_date = today.strftime("%Y-%m-%d")
        if not to_date:
            to_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

        print(f"[DATA] Fetching earnings calendar from {from_date} to {to_date}")
        earnings_data = fmp_client.get_earnings_calendar_range(from_date, to_date)
        if not earnings_data:
            return []

        name_map = _ticker_name_map()

        result = []
        for earning in earnings_data[:limit]:
            ticker = (earning.get("symbol") or "").upper()
            result.append({
                "symbol": ticker,
                "date": earning.get("date"),
                "company_name": name_map.get(ticker) or ticker,
                "eps_estimated": earning.get("epsEstimated"),
                "eps_actual": earning.get("epsActual"),
                "revenue_estimated": earning.get("revenueEstimated"),
                "revenue_actual": earning.get("revenueActual"),
            })
        return result
    except Exception as exc:
        print(f"Error in get_earnings_calendar_range: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/")
@ttl_cache(seconds=60)
def get_earnings(
    mode: str = "upcoming",
    window: str = "week",
    tickers: str = None,
    limit: int = 8,
    offset: int = 0,
):
    """Earnings calendar filtered by mode/window and optional tickers (CSV)."""
    try:
        today = datetime.now().date()
        if mode == "recent":
            if window == "today":
                start = end = today
            else:
                start = today - timedelta(days=7)
                end = today
        else:
            if window == "today":
                start = end = today
            else:
                start = today
                end = _next_friday(today)

        start_str = start.strftime("%Y-%m-%d")
        end_str = end.strftime("%Y-%m-%d")

        tickers_list = [t.strip().upper() for t in tickers.split(",")] if tickers else None

        name_map = {}
        for raw, name in _ticker_name_map().items():
            name_map[raw] = name or raw
            name_map[_normalize_ticker_dot_hyphen(raw)] = name or raw

        rows = db.get_earnings_calendar(from_date=start_str, to_date=end_str)

        if tickers_list:
            rows = [r for r in rows if (r.get("ticker") or "").upper() in tickers_list]

        if not rows:
            refresh_earnings_window(start_str, end_str, tickers=tickers_list)
            rows = db.get_earnings_calendar(from_date=start_str, to_date=end_str)
            if tickers_list:
                rows = [r for r in rows if (r.get("ticker") or "").upper() in tickers_list]

        filtered = [r for r in rows if r.get("eps_estimate") is not None]
        filtered.sort(key=lambda r: r.get("report_date") or r.get("date") or "", reverse=(mode == "recent"))

        total = len(filtered)
        paged = filtered[offset : offset + limit]

        def _last_surprise(tk: str):
            try:
                earnings_history = fmp_client.get_earnings_history(tk, limit=10)
                if earnings_history:
                    today_str = datetime.now().strftime("%Y-%m-%d")
                    past_earnings = [
                        e for e in earnings_history
                        if e.get("date") and e.get("date") < today_str
                           and e.get("epsActual") is not None
                           and e.get("epsEstimated") is not None
                    ]
                    if past_earnings:
                        past_earnings.sort(key=lambda x: x.get("date", ""), reverse=True)
                        last_report = past_earnings[0]
                        return last_report.get("epsActual") - last_report.get("epsEstimated")
                return None
            except Exception as e:
                print(f"Error calculating last surprise for {tk}: {e}")
                return None

        page_tickers = [(r.get("ticker") or "").upper() for r in paged]
        # One FMP call per row; run them concurrently instead of sequentially.
        if page_tickers:
            with ThreadPoolExecutor(max_workers=min(8, len(page_tickers))) as pool:
                surprises = list(pool.map(_last_surprise, page_tickers))
        else:
            surprises = []

        for r, tk, surprise in zip(paged, page_tickers, surprises):
            r["company_name"] = name_map.get(tk) or name_map.get(_normalize_ticker_dot_hyphen(tk)) or r.get("company_name") or tk
            r["last_surprise"] = surprise

        return {"items": paged, "total": total}
    except Exception as exc:
        print(f"Error in get_earnings: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# NOTE: these AI-summary routes MUST be declared before the "/{symbol}" catch-all
# below, otherwise FastAPI would match "earnings-summary" as a stock symbol.
@router.get("/earnings-summary")
def get_earnings_summary():
    """Return the latest Gemini-generated upcoming-earnings summary.

    Generates lazily on first request (or when the cached copy is stale) so the
    page shows content without a manual refresh.
    """
    try:
        return get_or_generate_earnings_summary()
    except Exception as exc:
        print(f"Error in get_earnings_summary: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/earnings-summary/refresh")
def refresh_earnings_summary():
    """Force-generate a new upcoming-earnings summary via Gemini."""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the server.",
        )
    try:
        ok = generate_earnings_summary(force=True)
        if not ok:
            detail = get_last_generation_error() or (
                "Earnings summary generation failed. Check server logs."
            )
            raise HTTPException(status_code=500, detail=detail)
        return get_earnings_summary_response()
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in refresh_earnings_summary: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{symbol}")
def get_stock_earnings(symbol: str, limit: int = 4):
    """Get earnings history for a specific stock with calculated surprises."""
    try:
        ticker = symbol.upper()
        print(f"[DATA] Fetching earnings for {ticker}")

        earnings_data = fmp_client.get_earnings_history(ticker, limit=limit)
        if not earnings_data:
            print(f"[WARN] No earnings data returned for {ticker}")
            return []

        result = []
        for earning in earnings_data:
            eps_actual = earning.get("epsActual")
            eps_estimated = earning.get("epsEstimated")
            surprise = None
            if eps_actual is not None and eps_estimated is not None:
                surprise = eps_actual - eps_estimated

            result.append({
                "symbol": earning.get("symbol"),
                "date": earning.get("date"),
                "epsActual": eps_actual,
                "epsEstimated": eps_estimated,
                "revenueActual": earning.get("revenueActual"),
                "revenueEstimated": earning.get("revenueEstimated"),
                "surprise": surprise,
                "lastUpdated": earning.get("lastUpdated"),
            })
        return result
    except Exception as exc:
        print(f"Error in get_stock_earnings: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
