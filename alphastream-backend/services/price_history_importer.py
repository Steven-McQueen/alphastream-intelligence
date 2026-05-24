"""
Price history importer using FMP stable endpoints.
Stores intraday and EOD bars in SQLite (price_bars table).

ARCHITECTURE: Display first, cache later.
- If cache hit: return immediately
- If cache miss: fetch from FMP, return to user, cache in background (async)
"""

import threading
from datetime import datetime, timedelta
from typing import List, Optional
from database.db_manager import db
from services.fmp_client import fmp_client

# EOD data is considered stale after 24 hours
EOD_TTL_HOURS = 24
# Intraday data is considered stale after 5 minutes during market hours
INTRADAY_TTL_MINUTES = 5


def _is_eod_stale(symbol: str) -> bool:
    """Check if EOD data for a symbol is stale (older than EOD_TTL_HOURS)."""
    last_updated = db.get_eod_last_updated(symbol)
    if not last_updated:
        return True
    
    try:
        # Parse the ISO timestamp
        last_dt = datetime.fromisoformat(last_updated)
        stale_threshold = datetime.now() - timedelta(hours=EOD_TTL_HOURS)
        return last_dt < stale_threshold
    except (ValueError, TypeError):
        return True


def _is_intraday_stale(symbol: str, timeframe: str = "5min") -> bool:
    """Check if intraday data for a symbol is stale (older than INTRADAY_TTL_MINUTES)."""
    last_updated = db.get_intraday_last_updated(symbol, timeframe)
    if not last_updated:
        return True
    
    try:
        # Parse the ISO timestamp
        last_dt = datetime.fromisoformat(last_updated)
        stale_threshold = datetime.now() - timedelta(minutes=INTRADAY_TTL_MINUTES)
        return last_dt < stale_threshold
    except (ValueError, TypeError):
        return True


def _normalize_bar(symbol: str, timeframe: str, bar: dict, source: str) -> dict:
    """
    Normalize bar data from FMP.
    FMP intraday returns: open, high, low, close, volume
    FMP EOD (full endpoint) returns: open, high, low, close, volume, change, changePercent, vwap
    """
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "bar_time": bar.get("date"),
        "open": bar.get("open"),
        "high": bar.get("high"),
        "low": bar.get("low"),
        "close": bar.get("close"),
        "volume": bar.get("volume"),
        "source": source,
    }


def refresh_intraday(symbol: str, interval: str = "5min", limit: int = 400) -> int:
    """
    Fetch intraday bars and merge with cache via upsert.
    Does NOT delete existing data - just updates/inserts new bars.
    """
    try:
        bars = fmp_client.get_intraday_chart(symbol, interval=interval)
        if not bars:
            print(f"[WARN] No intraday data returned from FMP for {symbol}")
            return 0

        # API returns newest first; trim to limit
        bars = bars[:limit]
        normalized = [_normalize_bar(symbol, interval, b, "fmp") for b in bars]
        count = db.upsert_price_bars_bulk(normalized)
        print(f"[OK] Intraday refresh for {symbol} ({interval}): {count} bars stored")
        return count
    except Exception as exc:
        print(f"[ERROR] Intraday refresh failed for {symbol}: {exc}")
        return 0


def refresh_eod(symbol: str, limit: int = 1300) -> int:
    """
    Fetch end-of-day history and merge with cache via upsert.
    Does NOT delete existing data - just updates/inserts new bars.
    Limit of 1300 covers ~5 years of trading days.
    """
    try:
        bars = fmp_client.get_eod_history(symbol, adjusted=False, limit=limit)
        if not bars:
            print(f"[WARN] No EOD data returned from FMP for {symbol}")
            return 0

        bars = bars[:limit]
        normalized = [_normalize_bar(symbol, "1day", b, "fmp") for b in bars]
        count = db.upsert_price_bars_bulk(normalized)
        print(f"[OK] EOD refresh for {symbol}: {count} bars stored")
        return count
    except Exception as exc:
        print(f"[ERROR] EOD refresh failed for {symbol}: {exc}")
        return 0


def _cache_bars_async(symbol: str, timeframe: str, bars: List[dict], source: str = "fmp"):
    """Cache bars to DB in background thread (fire and forget)."""
    def _do_cache():
        try:
            normalized = [_normalize_bar(symbol, timeframe, b, source) for b in bars]
            count = db.upsert_price_bars_bulk(normalized)
            print(f"[CACHE] Background cache for {symbol} ({timeframe}): {count} bars stored")
        except Exception as e:
            print(f"[CACHE ERROR] Failed to cache {symbol} ({timeframe}): {e}")

    thread = threading.Thread(target=_do_cache, daemon=True)
    thread.start()


def get_or_fetch_intraday(symbol: str, interval: str = "5min", limit: int = 400) -> List[dict]:
    """
    Return intraday bars - DISPLAY FIRST, CACHE LATER.

    1. Try cache (fast path)
    2. If cache miss → fetch from FMP → return immediately → cache async
    """
    # Fast path: check cache first
    bars = db.get_price_bars(symbol, interval, limit=limit)

    if bars and len(bars) >= 20:
        # Cache hit - return immediately
        return list(reversed(bars))  # oldest -> newest

    # Cache miss - fetch from FMP
    print(f"[FETCH] Getting intraday data for {symbol} ({interval}) from FMP...")
    try:
        fmp_bars = fmp_client.get_intraday_chart(symbol, interval=interval)
        if not fmp_bars:
            print(f"[WARN] No intraday data from FMP for {symbol}")
            return list(reversed(bars)) if bars else []

        # Trim to limit
        fmp_bars = fmp_bars[:limit]

        # Cache in background (don't block response)
        _cache_bars_async(symbol, interval, fmp_bars)

        # Return FMP data immediately (convert to same format as DB)
        return [
            {
                "symbol": symbol,
                "timeframe": interval,
                "bar_time": bar.get("date"),
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": bar.get("volume"),
                "source": "fmp",
            }
            for bar in reversed(fmp_bars)  # oldest -> newest
        ]
    except Exception as e:
        print(f"[ERROR] FMP fetch failed for {symbol}: {e}")
        return list(reversed(bars)) if bars else []


def get_or_fetch_eod(symbol: str, limit: int = 1300) -> List[dict]:
    """
    Return EOD bars - DISPLAY FIRST, CACHE LATER.

    1. Try cache (fast path)
    2. If cache miss → fetch from FMP → return immediately → cache async
    """
    # Fast path: check cache first
    bars = db.get_price_bars(symbol, "1day", limit=limit)

    if bars and len(bars) >= 50:
        # Cache hit - return immediately
        return list(reversed(bars))  # oldest -> newest

    # Cache miss - fetch from FMP
    print(f"[FETCH] Getting EOD data for {symbol} from FMP...")
    try:
        fmp_bars = fmp_client.get_eod_history(symbol, adjusted=False, limit=limit)
        if not fmp_bars:
            print(f"[WARN] No EOD data from FMP for {symbol}")
            return list(reversed(bars)) if bars else []

        # Trim to limit
        fmp_bars = fmp_bars[:limit]

        # Cache in background (don't block response)
        _cache_bars_async(symbol, "1day", fmp_bars)

        # Return FMP data immediately (convert to same format as DB)
        return [
            {
                "symbol": symbol,
                "timeframe": "1day",
                "bar_time": bar.get("date"),
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": bar.get("volume"),
                "source": "fmp",
            }
            for bar in reversed(fmp_bars)  # oldest -> newest
        ]
    except Exception as e:
        print(f"[ERROR] FMP fetch failed for {symbol}: {e}")
        return list(reversed(bars)) if bars else []


def compute_return_from_eod(symbol: str, window_days: int = 7) -> Optional[float]:
    """
    Compute simple return over window_days using EOD closes.
    Return in percent.
    """
    bars = get_or_fetch_eod(symbol, limit=window_days + 2)
    if len(bars) < 2:
        return None
    start = bars[0].get("close")
    end = bars[-1].get("close")
    if start in (None, 0) or end is None:
        return None
    return ((end - start) / start) * 100.0

