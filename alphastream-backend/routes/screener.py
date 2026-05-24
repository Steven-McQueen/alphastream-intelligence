"""Server-side screener endpoint (/api/screener)."""

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from database.db_manager import db
from services.fmp_client import fmp_client

router = APIRouter()


def _cache_screener_to_db(results: List[Dict]):
    """Cache screener results to stocks table for cross-view updates."""
    if not results:
        return
    updates = []
    for item in results[:100]:
        updates.append({
            "ticker": item.get("symbol"),
            "name": item.get("companyName"),
            "sector": item.get("sector"),
            "industry": item.get("industry"),
            "price": item.get("price", 0),
            "market_cap": item.get("marketCap", 0),
            "beta": item.get("beta"),
            "dividend_yield": item.get("lastAnnualDividend", 0),
            "volume": item.get("volume", 0),
        })
    if updates:
        try:
            db.upsert_stocks_from_screener(updates)
        except Exception as e:
            print(f"[SCREENER CACHE] Error caching: {e}")


@router.get("/api/screener")
async def screener(
    sector: Optional[str] = None,
    industry: Optional[str] = None,
    marketCapMoreThan: Optional[float] = None,
    marketCapLowerThan: Optional[float] = None,
    betaMoreThan: Optional[float] = None,
    betaLowerThan: Optional[float] = None,
    priceMoreThan: Optional[float] = None,
    priceLowerThan: Optional[float] = None,
    dividendMoreThan: Optional[float] = None,
    dividendLowerThan: Optional[float] = None,
    volumeMoreThan: Optional[int] = None,
    volumeLowerThan: Optional[int] = None,
    limit: int = Query(100, ge=1, le=1000),
    page: int = Query(0, ge=0),
):
    """Server-side stock screener using FMP company-screener endpoint."""
    try:
        results = fmp_client.call_company_screener(
            sector=sector,
            industry=industry,
            market_cap_more_than=marketCapMoreThan,
            market_cap_lower_than=marketCapLowerThan,
            beta_more_than=betaMoreThan,
            beta_lower_than=betaLowerThan,
            price_more_than=priceMoreThan,
            price_lower_than=priceLowerThan,
            dividend_more_than=dividendMoreThan,
            dividend_lower_than=dividendLowerThan,
            volume_more_than=volumeMoreThan,
            volume_lower_than=volumeLowerThan,
            limit=limit,
        )

        if not results:
            return {"items": [], "total": 0, "page": page}

        items = []
        for item in results:
            items.append({
                "ticker": item.get("symbol"),
                "name": item.get("companyName"),
                "sector": item.get("sector"),
                "industry": item.get("industry"),
                "price": item.get("price", 0),
                "marketCap": item.get("marketCap", 0),
                "beta": item.get("beta"),
                "dividendYield": item.get("lastAnnualDividend", 0),
                "volume": item.get("volume", 0),
                "exchange": item.get("exchangeShortName"),
                "country": item.get("country"),
                "isActivelyTrading": item.get("isActivelyTrading", True),
            })

        start_idx = page * limit
        end_idx = start_idx + limit
        paginated = items[start_idx:end_idx] if page > 0 else items[:limit]

        try:
            _cache_screener_to_db(results)
        except Exception as cache_err:
            print(f"[SCREENER] Cache warning: {cache_err}")

        return {"items": paginated, "total": len(items), "page": page}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in screener: {e}")
        raise HTTPException(status_code=500, detail=str(e))
