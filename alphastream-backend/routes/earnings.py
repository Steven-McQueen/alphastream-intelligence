"""Earnings calendar and per-stock earnings endpoints (/api/earnings/*)."""

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from services.fmp_client import fmp_client
from services.earnings_importer import refresh_earnings_window

router = APIRouter(prefix="/api/earnings")


def _normalize_ticker_dot_hyphen(t: str) -> str:
    return t.replace(".", "-").upper()


def _next_friday(start_date) -> "datetime.date":
    days_ahead = (4 - start_date.weekday()) % 7
    return start_date + timedelta(days=days_ahead)


@router.get("/calendar")
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

        all_stocks = db.get_all_stocks()
        name_map = {s["ticker"].upper(): s.get("name", s["ticker"]) for s in all_stocks if s.get("ticker")}

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

        all_stocks = db.get_all_stocks()
        name_map = {}
        for s in all_stocks:
            if s.get("ticker"):
                raw = s["ticker"].upper()
                name_map[raw] = s.get("name") or raw
                name_map[_normalize_ticker_dot_hyphen(raw)] = s.get("name") or raw

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

        for r in paged:
            tk = (r.get("ticker") or "").upper()
            r["company_name"] = name_map.get(tk) or name_map.get(_normalize_ticker_dot_hyphen(tk)) or r.get("company_name") or tk

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
                        surprise = last_report.get("epsActual") - last_report.get("epsEstimated")
                        r["last_surprise"] = surprise
                    else:
                        r["last_surprise"] = None
                else:
                    r["last_surprise"] = None
            except Exception as e:
                print(f"Error calculating last surprise for {tk}: {e}")
                r["last_surprise"] = None

        return {"items": paged, "total": total}
    except Exception as exc:
        print(f"Error in get_earnings: {exc}")
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
