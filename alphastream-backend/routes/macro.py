"""Macro data endpoints (/api/macro/*)."""

from datetime import datetime

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from services.response_cache import ttl_cache

router = APIRouter(prefix="/api/macro")

# TTLs: the underlying tables only change when the refresh scheduler writes
# (every 5-15 min during market hours), so short in-memory caches collapse the
# frontend's ~30s polling into one DB round-trip per window.


@router.get("/latest")
@ttl_cache(seconds=30)
async def get_latest_macro_snapshot():
    """Get latest values for Today's Snapshot."""
    try:
        indices = db.get_all_indices()
        if not indices:
            raise HTTPException(status_code=503, detail="Data not available")
        indices_dict = {idx["symbol"]: idx for idx in indices}

        def pick_index(*symbols):
            for sym in symbols:
                if sym in indices_dict:
                    return indices_dict[sym]
            return {}

        treasury = db.get_treasury_history(days=2)
        if not treasury:
            raise HTTPException(status_code=503, detail="Data not available")
        us10y = treasury[-1]["yield_10y"] if treasury else None
        us10y_change = None
        if len(treasury) >= 2:
            us10y_change = treasury[-1]["yield_10y"] - treasury[-2]["yield_10y"]

        vix_history = db.get_vix_history(days=2)
        if not vix_history:
            raise HTTPException(status_code=503, detail="Data not available")
        vix_value = vix_history[-1]["vix_close"] if vix_history else None
        vix_change = None
        if len(vix_history) >= 2 and vix_history[-2]["vix_close"]:
            prev_vix = vix_history[-2]["vix_close"]
            if prev_vix:
                vix_change = ((vix_history[-1]["vix_close"] - prev_vix) / prev_vix) * 100

        spx_row = pick_index("^GSPC", "SPX")
        ndx_row = pick_index("^IXIC", "NDX")
        dji_row = pick_index("^DJI", "DJI")
        rut_row = pick_index("^RUT", "RUT")

        snapshot = {
            "SPX": {
                "value": spx_row.get("value"),
                "change_percent": spx_row.get("change_pct") or spx_row.get("change_percent"),
            },
            "NDX": {
                "value": ndx_row.get("value"),
                "change_percent": ndx_row.get("change_pct") or ndx_row.get("change_percent"),
            },
            "DJI": {
                "value": dji_row.get("value"),
                "change_percent": dji_row.get("change_pct") or dji_row.get("change_percent"),
            },
            "RUT": {
                "value": rut_row.get("value"),
                "change_percent": rut_row.get("change_pct") or rut_row.get("change_percent"),
            },
            "US10Y": {"value": us10y, "change": us10y_change},
            "VIX": {"value": vix_value, "change_percent": vix_change},
            "last_updated": datetime.now().isoformat(),
        }
        return snapshot
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_latest_macro_snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/indices")
@ttl_cache(seconds=30)
def get_market_indices():
    """Get current market indices (SPX, NDX, DJI, RUT, VIX)."""
    try:
        indices = db.get_all_indices()
        if not indices:
            raise HTTPException(status_code=503, detail="Data not available")
        return indices
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_market_indices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/indicators")
@ttl_cache(seconds=60)
def get_macro_indicators():
    """Get current macro indicators (yields, CPI, GDP, unemployment, DXY)."""
    try:
        indicators = db.get_all_indicators()
        if not indicators:
            raise HTTPException(status_code=503, detail="Data not available")
        return indicators
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_macro_indicators: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/treasury-history")
@ttl_cache(seconds=300)
def get_treasury_history(days: int = 365):
    """Get 12 months of US 10Y and 2Y treasury yield history."""
    try:
        history = db.get_treasury_history(days=days)
        if not history:
            raise HTTPException(status_code=503, detail="Data not available")
        return history
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_treasury_history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cpi-history")
@ttl_cache(seconds=600)
def get_cpi_history(months: int = 12):
    """Get 12 months of CPI history."""
    try:
        history = db.get_cpi_history(months=months)
        if not history:
            raise HTTPException(status_code=503, detail="Data not available")
        return [
            {
                "date": item["date"],
                "cpi_value": item.get("cpi_value"),
                "mom_change": item.get("mom_change"),
                "yoy_change": item.get("yoy_change"),
            }
            for item in history
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_cpi_history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vix-history")
@ttl_cache(seconds=300)
def get_vix_history(days: int = 365):
    """Get 12 months of VIX history."""
    try:
        history = db.get_vix_history(days=days)
        if not history:
            raise HTTPException(status_code=503, detail="Data not available")
        return [
            {
                "date": item["date"],
                "vix_value": item.get("vix_close"),
                "vix_high": item.get("vix_high"),
                "vix_low": item.get("vix_low"),
            }
            for item in history
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_vix_history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alternative-assets")
@ttl_cache(seconds=60)
async def get_alternative_assets():
    """Get all alternative assets (crypto, commodities, currencies)."""
    try:
        assets = db.get_all_alternative_assets()
        if not assets:
            raise HTTPException(
                status_code=503,
                detail="Alternative assets table is empty - initialization may have failed",
            )

        failed = [a for a in assets if a.get("fetch_error") is not None]
        if failed:
            print(f"[WARN] Warning: {len(failed)} alternative assets have fetch errors")
            for asset in failed:
                print(f"  - {asset['symbol']}: {asset.get('fetch_error')}")

        return assets
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error in get_alternative_assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ticker-all")
@ttl_cache(seconds=30)
async def get_ticker_all():
    """Get combined ticker data for global ticker."""
    try:
        ticker_items = []

        try:
            indices = db.get_all_indices()
            for idx in indices:
                ticker_items.append({
                    "symbol": idx.get("symbol"),
                    "name": idx.get("name"),
                    "value": idx.get("value"),
                    "change": idx.get("change"),
                    "changePercent": idx.get("change_pct") or idx.get("change_percent"),
                    "category": "equity",
                    "displayFormat": "decimal",
                    "error": None,
                })
        except Exception as e:
            print(f"[ERROR] Failed to fetch indices for ticker: {e}")

        try:
            treasury = db.get_treasury_history(days=2)
            if treasury and len(treasury) >= 2:
                latest = treasury[-1]
                prev = treasury[-2]

                if latest.get("yield_10y") is not None and prev.get("yield_10y") is not None:
                    us10y_change = latest["yield_10y"] - prev["yield_10y"]
                    us10y_change_pct = (us10y_change / prev["yield_10y"]) * 100 if prev["yield_10y"] else None
                    ticker_items.append({
                        "symbol": "US10Y",
                        "name": "10-Year Treasury",
                        "value": latest["yield_10y"],
                        "change": round(us10y_change, 3) if us10y_change is not None else None,
                        "changePercent": round(us10y_change_pct, 2) if us10y_change_pct is not None else None,
                        "category": "macro",
                        "displayFormat": "percent",
                        "error": None,
                    })

                if latest.get("yield_2y") is not None and prev.get("yield_2y") is not None:
                    us2y_change = latest["yield_2y"] - prev["yield_2y"]
                    us2y_change_pct = (us2y_change / prev["yield_2y"]) * 100 if prev["yield_2y"] else None
                    ticker_items.append({
                        "symbol": "US2Y",
                        "name": "2-Year Treasury",
                        "value": latest["yield_2y"],
                        "change": round(us2y_change, 3) if us2y_change is not None else None,
                        "changePercent": round(us2y_change_pct, 2) if us2y_change_pct is not None else None,
                        "category": "macro",
                        "displayFormat": "percent",
                        "error": None,
                    })
        except Exception as e:
            print(f"[ERROR] Failed to fetch treasury data for ticker: {e}")

        try:
            alt_assets = db.get_all_alternative_assets()
            for asset in alt_assets:
                ticker_items.append({
                    "symbol": asset.get("symbol"),
                    "name": asset.get("name"),
                    "value": asset.get("value"),
                    "change": asset.get("change"),
                    "changePercent": asset.get("change_percent"),
                    "category": asset.get("asset_type"),
                    "displayFormat": "currency" if asset.get("asset_type") != "currency" else "decimal",
                    "error": asset.get("fetch_error"),
                })
        except Exception as e:
            print(f"[ERROR] Failed to fetch alternative assets for ticker: {e}")

        if not ticker_items:
            raise HTTPException(
                status_code=503, detail="No ticker data available - all data sources failed"
            )

        total = len(ticker_items)
        failed = sum(
            1
            for item in ticker_items
            if item.get("error") is not None or item.get("value") is None
        )
        print(f"[DATA] Ticker endpoint: {total} items ({failed} with errors or nulls)")

        return ticker_items
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error in get_ticker_all: {e}")
        raise HTTPException(status_code=500, detail=str(e))
