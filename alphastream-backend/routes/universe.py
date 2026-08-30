"""Universe / stock-list endpoints (/api/universe/*)."""

import json
import threading
from typing import Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response

from database.db_manager import db
from dto.stock import stock_to_list_item
from middleware.auth import require_admin
from services.fmp_client import fmp_client
from services.response_cache import ttl_cache
from services.universe_importer import (
    fetch_and_import_full_universe,
    fetch_and_set_sp500_flags,
    refresh_universe_quotes_tiered,
    refresh_full_universe_quotes,
    run_daily_universe_refresh,
    get_universe_stats,
    populate_stocks_from_symbols,
    bootstrap_sp500_stocks,
)

router = APIRouter(prefix="/api/universe")

# Background population status tracking
_population_status: Dict = {"running": False, "progress": 0, "total": 0, "completed": 0, "error": None}


# ── Read endpoints ──────────────────────────────────────────────────────────

@ttl_cache(seconds=30)
def _universe_core_json() -> str:
    """Pre-serialized universe list; encoding ~24k rows dominates this endpoint,
    so the cache stores the final JSON string, not the Python objects."""
    # Column-trimmed query: the list DTO only needs ~25 of the 40+ columns,
    # and the full table is large enough that transfer time dominates.
    stocks = db.get_stock_list_rows()
    if not stocks:
        raise HTTPException(status_code=503, detail="Data not available")
    items = [stock_to_list_item(s) for s in stocks]
    # Mirror FastAPI's default JSONResponse serialization options so the
    # payload bytes are identical to the uncached implementation.
    return json.dumps(
        jsonable_encoder(items),
        ensure_ascii=False,
        allow_nan=False,
        indent=None,
        separators=(",", ":"),
    )


@router.get("/core")
def get_universe_core():
    """Get all S&P 500 stocks from database."""
    try:
        return Response(content=_universe_core_json(), media_type="application/json")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_universe_core: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/directory")
def get_universe_directory():
    """Compact ticker+name directory of the full universe (no quotes).

    Screener uses this to paginate/search ~24k names while /core stays S&P 500.
    """
    try:
        items = db.get_symbol_directory()
        return {"items": items, "total": len(items)}
    except Exception as e:
        print(f"Error in get_universe_directory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
def search_universe(q: str = Query(..., min_length=1)):
    """Search stocks by ticker or name."""
    try:
        stocks = db.search_stocks(q)
        if not stocks:
            raise HTTPException(status_code=503, detail="Data not available")
        return [stock_to_list_item(s) for s in stocks]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in search_universe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/symbols/count")
@ttl_cache(seconds=300)
def get_symbols_count():
    """Get count of symbols by category."""
    try:
        return get_universe_stats()
    except Exception as e:
        print(f"Error in get_symbols_count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search-symbols")
def search_symbols(q: str = Query(..., min_length=1), limit: int = 20):
    """Search symbols table (24k+ records)."""
    try:
        return db.search_symbols(q, limit=limit)
    except Exception as e:
        print(f"Error in search_symbols: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/populate-status")
def get_populate_status():
    """Get status of background population job."""
    return _population_status


# ── Admin endpoints (require API key) ───────────────────────────────────────

@router.post("/symbols/import", dependencies=[Depends(require_admin)])
def import_full_universe():
    """Import full symbol universe from FMP."""
    try:
        count = fetch_and_import_full_universe()
        return {"status": "success", "symbols_imported": count}
    except Exception as e:
        print(f"Error in import_full_universe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/symbols/sp500", dependencies=[Depends(require_admin)])
def set_sp500_symbols():
    """Set S&P 500 flags on symbols table."""
    try:
        count = fetch_and_set_sp500_flags()
        return {"status": "success", "sp500_flagged": count}
    except Exception as e:
        print(f"Error in set_sp500_symbols: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh/tiered", dependencies=[Depends(require_admin)])
def refresh_tiered():
    """Refresh quotes for tiered symbols (S&P 500 = tier 1)."""
    try:
        results = refresh_universe_quotes_tiered()
        return {"status": "success", **results}
    except Exception as e:
        print(f"Error in refresh_tiered: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh/full", dependencies=[Depends(require_admin)])
def refresh_full():
    """Refresh quotes for ALL active symbols."""
    try:
        count = refresh_full_universe_quotes()
        return {"status": "success", "quotes_updated": count}
    except Exception as e:
        print(f"Error in refresh_full: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daily-refresh", dependencies=[Depends(require_admin)])
def trigger_daily_refresh():
    """Run full daily universe refresh."""
    try:
        results = run_daily_universe_refresh()
        return {"status": "success", **results}
    except Exception as e:
        print(f"Error in trigger_daily_refresh: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/populate-stocks", dependencies=[Depends(require_admin)])
def trigger_populate_stocks():
    """Populate stocks table from symbols table."""
    try:
        count = populate_stocks_from_symbols()
        return {"status": "success", "stocks_populated": count}
    except Exception as e:
        print(f"Error in populate_stocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bootstrap-sp500", dependencies=[Depends(require_admin)])
def trigger_bootstrap_sp500():
    """Quick bootstrap: Load only S&P 500 stocks into the stocks table."""
    try:
        count = bootstrap_sp500_stocks()
        return {"status": "success", "stocks_loaded": count, "message": f"Loaded {count} S&P 500 stocks"}
    except Exception as e:
        print(f"Error in bootstrap_sp500: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/populate-background", dependencies=[Depends(require_admin)])
async def populate_stocks_background(background_tasks: BackgroundTasks):
    """Start background population of stocks table."""
    global _population_status

    if _population_status["running"]:
        return {"status": "already_running", **_population_status}

    background_tasks.add_task(_background_populate_stocks)
    return {"status": "started", "message": "Background population started. Check /api/universe/populate-status for progress."}


def _background_populate_stocks():
    """Background task to populate stocks in batches."""
    global _population_status
    from sqlalchemy import text

    try:
        _population_status = {"running": True, "progress": 0, "total": 0, "completed": 0, "error": None}

        with db.get_session() as session:
            result = session.execute(text("SELECT symbol FROM symbols WHERE is_active = TRUE ORDER BY symbol"))
            all_symbols = [row.symbol for row in result.fetchall()]

        _population_status["total"] = len(all_symbols)
        print(f"[BACKGROUND] Starting population of {len(all_symbols)} symbols...")

        batch_size = 100
        for i in range(0, len(all_symbols), batch_size):
            batch = all_symbols[i:i + batch_size]
            quotes = fmp_client.get_batch_quotes_optimized(batch)
            if quotes:
                from services.universe_importer import _quotes_to_stocks
                stocks = _quotes_to_stocks(quotes)
                db.insert_stocks_bulk(stocks)

            _population_status["completed"] += len(batch)
            _population_status["progress"] = round(
                (_population_status["completed"] / _population_status["total"]) * 100, 1
            )
            print(f"[BACKGROUND] Progress: {_population_status['progress']}% ({_population_status['completed']}/{_population_status['total']})")

        db.sync_sp500_flags_to_stocks()
        db.sync_sector_industry_to_stocks()
        _population_status["running"] = False
        print("[BACKGROUND] Population complete!")

    except Exception as e:
        print(f"[BACKGROUND] Error: {e}")
        _population_status["running"] = False
        _population_status["error"] = str(e)
