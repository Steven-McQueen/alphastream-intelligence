"""Market calendar endpoints: IPOs, dividends, and stock splits (/api/calendar/*).

Mirrors the earnings calendar route: fetches from FMP for a date range and enriches
with company names from the local universe where available.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from services.fmp_client import fmp_client
from services.response_cache import ttl_cache

router = APIRouter(prefix="/api/calendar")


def _default_range(from_date: str = None, to_date: str = None):
    today = datetime.now().date()
    if not from_date:
        from_date = today.strftime("%Y-%m-%d")
    if not to_date:
        to_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")
    return from_date, to_date


@ttl_cache(seconds=600)
def _name_map() -> dict:
    try:
        return db.get_ticker_name_map() or {}
    except Exception:
        return {}


@router.get("/ipos")
@ttl_cache(seconds=600)
def get_ipos(from_date: str = None, to_date: str = None, limit: int = 500):
    """IPO calendar for a date range."""
    try:
        from_date, to_date = _default_range(from_date, to_date)
        data = fmp_client.get_ipos_calendar(from_date, to_date) or []
        names = _name_map()
        result = []
        for row in data[:limit]:
            symbol = (row.get("symbol") or "").upper()
            result.append({
                "symbol": symbol,
                "date": row.get("date"),
                "company_name": row.get("company") or names.get(symbol) or symbol,
                "exchange": row.get("exchange"),
                "actions": row.get("actions"),
                "shares": row.get("shares"),
                "price_range": row.get("priceRange"),
                "market_cap": row.get("marketCap"),
            })
        return result
    except Exception as exc:
        print(f"Error in get_ipos: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/dividends")
@ttl_cache(seconds=600)
def get_dividends(from_date: str = None, to_date: str = None, limit: int = 500):
    """Dividend calendar (ex-dates) for a date range."""
    try:
        from_date, to_date = _default_range(from_date, to_date)
        data = fmp_client.get_dividends_calendar(from_date, to_date) or []
        names = _name_map()
        result = []
        for row in data[:limit]:
            symbol = (row.get("symbol") or "").upper()
            result.append({
                "symbol": symbol,
                "date": row.get("date"),
                "company_name": names.get(symbol) or symbol,
                "record_date": row.get("recordDate"),
                "payment_date": row.get("paymentDate"),
                "declaration_date": row.get("declarationDate"),
                "dividend": row.get("dividend"),
                "adj_dividend": row.get("adjDividend"),
                "yield": row.get("yield"),
                "frequency": row.get("frequency"),
            })
        return result
    except Exception as exc:
        print(f"Error in get_dividends: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/splits")
@ttl_cache(seconds=600)
def get_splits(from_date: str = None, to_date: str = None, limit: int = 500):
    """Stock splits calendar for a date range."""
    try:
        from_date, to_date = _default_range(from_date, to_date)
        data = fmp_client.get_splits_calendar(from_date, to_date) or []
        names = _name_map()
        result = []
        for row in data[:limit]:
            symbol = (row.get("symbol") or "").upper()
            result.append({
                "symbol": symbol,
                "date": row.get("date"),
                "company_name": names.get(symbol) or symbol,
                "numerator": row.get("numerator"),
                "denominator": row.get("denominator"),
                "split_type": row.get("splitType"),
            })
        return result
    except Exception as exc:
        print(f"Error in get_splits: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/ipos/{symbol}/disclosure")
def get_ipo_disclosure(symbol: str):
    """IPO disclosure filings for a specific symbol."""
    try:
        return fmp_client.get_ipo_disclosure(symbol.upper()) or []
    except Exception as exc:
        print(f"Error in get_ipo_disclosure: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/ipos/{symbol}/prospectus")
def get_ipo_prospectus(symbol: str):
    """IPO prospectus filings for a specific symbol."""
    try:
        return fmp_client.get_ipo_prospectus(symbol.upper()) or []
    except Exception as exc:
        print(f"Error in get_ipo_prospectus: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
