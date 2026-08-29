"""Live-quote endpoints (/api/live/*)."""

import asyncio
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from database.db_manager import db
from services.fmp_client import fmp_client

router = APIRouter(prefix="/api/live")

LIVE_CACHE_SECONDS = 2
_live_quote_cache: Dict[str, Dict] = {}


def _live_quote(symbol: str) -> Dict:
    """Fetch live quote with short TTL cache to avoid duplicate calls within 2s window."""
    now_ts = datetime.utcnow().timestamp()
    cache = _live_quote_cache.get(symbol)
    if cache and now_ts - cache["ts"] < LIVE_CACHE_SECONDS:
        return cache["data"]

    data = fmp_client.get_quote(symbol)
    if (not data or data.get("price") is None) and symbol.startswith("^"):
        series = fmp_client.get_index_intraday_chart(symbol, interval="5min")
        if series:
            last = series[0] if isinstance(series, list) else None
            if last:
                data = {
                    "symbol": symbol,
                    "name": symbol,
                    "price": last.get("close"),
                    "change": 0,
                    "changesPercentage": 0,
                    "timestamp": last.get("date"),
                }

    if not data:
        raise HTTPException(status_code=503, detail=f"Live quote unavailable for {symbol}")

    payload = {
        "symbol": data.get("symbol") or symbol,
        "name": data.get("name") or symbol,
        "price": data.get("price"),
        "change": data.get("change") or data.get("changePercent") or 0,
        "changePercent": data.get("changesPercentage") or data.get("changePercent") or 0,
        "timestamp": data.get("timestamp") or datetime.utcnow().isoformat(),
    }
    _live_quote_cache[symbol] = {"ts": now_ts, "data": payload}
    return payload


@router.get("/quote")
def get_live_quote(symbol: str):
    """Live quote (2s TTL cache). Supports indices (caret symbols) and equities."""
    try:
        return _live_quote(symbol)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in get_live_quote: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/batch")
async def get_live_batch(symbols: str = Query(..., description="Comma-separated list of symbols")):
    """Batch live quotes for multiple symbols."""
    try:
        symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        if not symbol_list:
            raise HTTPException(status_code=400, detail="No symbols provided")
        if len(symbol_list) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 symbols per batch")

        def _fetch_one(symbol: str) -> Dict:
            try:
                quote = _live_quote(symbol)
                return {
                    "symbol": quote.get("symbol", symbol),
                    "value": quote.get("price", 0),
                    "changePercent": quote.get("changePercent", 0),
                    "price": quote.get("price", 0),
                    "change": quote.get("change", 0),
                }
            except Exception as e:
                return {
                    "symbol": symbol,
                    "value": None,
                    "changePercent": None,
                    "error": str(e),
                }

        # One FMP call per symbol; fan out to the threadpool instead of
        # fetching sequentially (order is preserved by gather).
        results = list(await asyncio.gather(
            *[run_in_threadpool(_fetch_one, symbol) for symbol in symbol_list]
        ))

        return results
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in get_live_batch: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
