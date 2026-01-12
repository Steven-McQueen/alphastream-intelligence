"""
Price history importer using FMP stable endpoints.
Stores intraday and EOD bars in SQLite (price_bars table).
"""

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


def refresh_intraday(symbol: str, interval: str = "5min", limit: int = 500) -> int:
    """Fetch intraday bars and cache."""
    try:
        # Clear old data first to ensure fresh data
        db.delete_intraday_bars(symbol, interval)
        
        bars = fmp_client.get_intraday_chart(symbol, interval=interval)
        if not bars:
            print(f"[WARN] No intraday data returned from FMP for {symbol}")
            return 0
        
        # API returns newest first; trim to limit then store
        bars = bars[:limit]
        normalized = [_normalize_bar(symbol, interval, b, "fmp") for b in bars]
        count = db.upsert_price_bars_bulk(normalized)
        print(f"[OK] Intraday refresh for {symbol} ({interval}): {count} bars stored")
        return count
    except Exception as exc:
        print(f"[ERROR] Intraday refresh failed for {symbol}: {exc}")
        return 0


def refresh_eod(symbol: str, limit: int = 2000) -> int:
    """
    Fetch end-of-day history and cache.
    Default limit of 2000 covers ~8 years of trading days (252 per year).
    """
    try:
        # Clear old data first to ensure fresh data
        db.delete_eod_bars(symbol)
        
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


def get_or_fetch_intraday(symbol: str, interval: str = "5min", limit: int = 500) -> List[dict]:
    """
    Return intraday bars from cache, fetching if empty or stale.
    Uses TTL-based cache invalidation to ensure fresh data.
    """
    bars = db.get_price_bars(symbol, interval, limit=limit)
    
    # Force refresh if no bars, data is stale, or data has null values
    needs_refresh = (
        not bars 
        or _is_intraday_stale(symbol, interval)
        or any(bar.get("close") is None for bar in bars[:5])  # Check first 5 bars for null
    )
    
    if needs_refresh:
        print(f"[REFRESH] Refreshing intraday data for {symbol} ({interval}) (stale or missing)")
        refresh_intraday(symbol, interval=interval, limit=limit)
        bars = db.get_price_bars(symbol, interval, limit=limit)
    
    return list(reversed(bars))  # oldest -> newest


def get_or_fetch_eod(symbol: str, limit: int = 2000) -> List[dict]:
    """
    Return EOD bars from cache, fetching if empty or stale.
    Uses TTL-based cache invalidation to ensure fresh data.
    """
    bars = db.get_price_bars(symbol, "1day", limit=limit)
    
    # Force refresh if no bars, data is stale, or data has null values
    needs_refresh = (
        not bars 
        or _is_eod_stale(symbol)
        or any(bar.get("close") is None for bar in bars[:5])  # Check first 5 bars for null
    )
    
    if needs_refresh:
        print(f"[REFRESH] Refreshing EOD data for {symbol} (stale or missing)")
        refresh_eod(symbol, limit=limit)
        bars = db.get_price_bars(symbol, "1day", limit=limit)
    
    return list(reversed(bars))  # oldest -> newest


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

