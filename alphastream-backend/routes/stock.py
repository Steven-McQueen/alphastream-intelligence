"""Single-stock detail and profile endpoints (/api/stock/*)."""

from datetime import datetime

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from dto.stock import stock_to_detail
from services.fmp_client import fmp_client
from services.refresh_scheduler import is_market_hours
from services.universe_importer import fetch_and_cache_single_stock

router = APIRouter(prefix="/api/stock")


@router.get("/{ticker}")
def get_stock(ticker: str, fresh: bool = False):
    """Get detailed information for a specific stock."""
    try:
        symbol = ticker.upper()

        stock, age_seconds = db.get_stock_with_age(symbol)

        market_open = is_market_hours()
        cache_ttl_seconds = 15 if market_open else 300

        need_fresh = False
        if not stock:
            need_fresh = True
        elif fresh and (age_seconds is None or age_seconds > cache_ttl_seconds):
            need_fresh = True

        if need_fresh:
            print(f"[STOCK] Fetching {symbol} from FMP (fresh={fresh}, age={age_seconds}s, market_open={market_open})")
            stock = fetch_and_cache_single_stock(symbol)

        if not stock:
            raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")

        try:
            db.increment_stock_view_count(symbol)
        except Exception:
            pass

        return stock_to_detail(stock, age_seconds)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/profile")
def get_stock_profile(ticker: str):
    """Get company profile including description, logo, CEO, employees, etc."""
    try:
        symbol = ticker.upper()

        cached_profile = db.get_cached_profile(symbol)
        if cached_profile:
            print(f"[CACHE HIT] Profile for {symbol} from cache")
            return cached_profile

        print(f"[CACHE MISS] Fetching profile for {symbol} from FMP")
        profile_data = fmp_client.get_company_profile(symbol)

        if not profile_data or len(profile_data) == 0:
            print(f"[WARN] No profile data returned for {symbol}")
            raise HTTPException(status_code=404, detail=f"Profile not found for {ticker}")

        profile = profile_data[0]

        result = {
            "symbol": profile.get("symbol", symbol),
            "companyName": profile.get("companyName", ""),
            "description": profile.get("description", ""),
            "image": profile.get("image", ""),
            "ceo": profile.get("ceo", ""),
            "sector": profile.get("sector", ""),
            "industry": profile.get("industry", ""),
            "website": profile.get("website", ""),
            "exchange": profile.get("exchange", ""),
            "exchangeFullName": profile.get("exchangeFullName", ""),
            "marketCap": profile.get("marketCap"),
            "averageVolume": profile.get("averageVolume"),
            "ipoDate": profile.get("ipoDate", ""),
            "country": profile.get("country", ""),
            "city": profile.get("city", ""),
            "state": profile.get("state", ""),
            "fullTimeEmployees": profile.get("fullTimeEmployees", ""),
            "price": profile.get("price"),
            "beta": profile.get("beta"),
            "lastDividend": profile.get("lastDividend"),
            "range": profile.get("range", ""),
        }

        try:
            db.set_cached_profile(symbol, result)
            print(f"[CACHE SET] Profile cached for {symbol}")
        except Exception as cache_err:
            print(f"[CACHE WARN] Failed to cache profile for {symbol}: {cache_err}")

        print(f"[OK] Profile fetched for {symbol}: {result.get('companyName')}")
        return result

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error in get_stock_profile for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
