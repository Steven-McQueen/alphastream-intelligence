"""Market overview endpoints (/api/market/*)."""

from datetime import datetime
from typing import Dict, List

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from services.fmp_client import fmp_client
from config import GEMINI_API_KEY
from services.market_summary_generator import (
    generate_market_summary,
    get_last_generation_error,
    get_market_summary_response,
    test_gemini_connection,
)
from services.sector_importer import get_sector_performance_summary

router = APIRouter(prefix="/api/market")

# In-memory caches
_intraday_cache: Dict[str, Dict] = {}
_sparkline_cache: Dict[str, Dict] = {}

INDEX_SYMBOL_MAP = {
    "SPX": "^GSPC", "NDX": "^IXIC", "DJI": "^DJI", "RUT": "^RUT", "VIX": "^VIX",
    "^GSPC": "^GSPC", "^IXIC": "^IXIC", "^DJI": "^DJI", "^RUT": "^RUT", "^VIX": "^VIX",
}


def _session_status_et() -> str:
    """Return session status in ET."""
    now = datetime.utcnow()
    if now.weekday() >= 5:
        return "Closed"
    hour = now.hour + now.minute / 60.0
    if 13.0 <= hour < 14.5:
        return "Pre-Market"
    if 14.5 <= hour < 21.0:
        return "Open"
    if 21.0 <= hour < 23.59:
        return "After-Hours"
    return "Closed"


@router.get("/sectors")
def get_sector_performance():
    """Calculate sector performance by aggregating stocks in database."""
    try:
        summary = get_sector_performance_summary()
        if summary:
            return [
                {
                    "sector": s.get("sector"),
                    "change1D": s.get("change1D", 0.0),
                    "change1W": s.get("change1W", 0.0),
                    "change1M": s.get("change1M", 0.0),
                    "stockCount": None,
                }
                for s in summary
            ]
        sectors = db.get_sector_performance()
        return [
            {
                "sector": sector["sector"],
                "change1D": sector.get("change_percent"),
                "change1W": 0.0,
                "change1M": 0.0,
                "stockCount": None,
            }
            for sector in sectors
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_sector_performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _build_insight_text(
    status: str,
    market_tone: str,
    spx_change: float | None,
    leaders: list,
    laggards: list,
) -> str:
    """Build a dynamic narrative based on session status and market conditions."""

    leader_text = ", ".join(
        [f"{l['sector']} ({l.get('change1D', 0):+.2f}%)" for l in leaders]
    ) if leaders else "no clear leaders"
    laggard_text = ", ".join(
        [f"{l['sector']} ({l.get('change1D', 0):+.2f}%)" for l in laggards]
    ) if laggards else "no clear laggards"

    change = spx_change if spx_change is not None else 0.0
    abs_change = abs(change)

    # --- Pre-Market ---
    if status == "Pre-Market":
        if change > 1.0:
            opener = "Futures point to a strong open as pre-market trading shows broad strength."
        elif change > 0.3:
            opener = "Pre-market indicators are tilting positive ahead of the opening bell."
        elif change < -1.0:
            opener = "Futures are pointing sharply lower as sellers dominate pre-market activity."
        elif change < -0.3:
            opener = "Pre-market trading is leaning negative with modest selling pressure."
        else:
            opener = "Futures are trading near flat as investors await the opening bell."
        return f"{opener} Leaders: {leader_text}; Laggards: {laggard_text}."

    # --- Market Open ---
    if status == "Open":
        if change > 2.0:
            opener = f"A strong rally is underway with the S&P 500 surging {abs_change:.1f}%. Risk appetite is elevated across sectors."
        elif change > 1.0:
            opener = f"Markets are trading firmly higher with the S&P 500 up {abs_change:.1f}%. Buyers are in control."
        elif change > 0.3:
            opener = f"Equities are modestly higher with the S&P 500 gaining {abs_change:.1f}%."
        elif change < -2.0:
            opener = f"A broad sell-off is in progress with the S&P 500 down {abs_change:.1f}%. Defensive positioning is dominant."
        elif change < -1.0:
            opener = f"Markets are under pressure with the S&P 500 falling {abs_change:.1f}%."
        elif change < -0.3:
            opener = f"Equities are drifting lower with the S&P 500 down {abs_change:.1f}%."
        else:
            opener = "Markets are trading in a tight range with no clear directional bias."
        return f"{opener} Leaders: {leader_text}; Laggards: {laggard_text}."

    # --- After-Hours ---
    if status == "After-Hours":
        if change > 1.0:
            opener = f"US equities closed sharply higher with the S&P 500 up {abs_change:.1f}%. After-hours trading remains constructive."
        elif change > 0.3:
            opener = f"Stocks ended the session in the green with the S&P 500 gaining {abs_change:.1f}%."
        elif change < -1.0:
            opener = f"US equities closed sharply lower with the S&P 500 down {abs_change:.1f}%. After-hours activity shows continued caution."
        elif change < -0.3:
            opener = f"Stocks ended the session lower with the S&P 500 declining {abs_change:.1f}%."
        else:
            opener = "Markets closed roughly flat. After-hours activity is muted."
        return f"{opener} Leaders: {leader_text}; Laggards: {laggard_text}."

    # --- Closed (weekend / off-hours) ---
    if change > 1.0:
        opener = f"Markets are closed after a strong session. The S&P 500 finished up {abs_change:.1f}%."
    elif change > 0.3:
        opener = f"Markets are closed. The last session ended with the S&P 500 up {abs_change:.1f}%."
    elif change < -1.0:
        opener = f"Markets are closed after a tough session. The S&P 500 fell {abs_change:.1f}%."
    elif change < -0.3:
        opener = f"Markets are closed. The last session ended with the S&P 500 down {abs_change:.1f}%."
    else:
        opener = "Markets are closed. The last session ended near flat."
    return f"{opener} Leaders: {leader_text}; Laggards: {laggard_text}."


@router.get("/market-summary")
def get_market_summary():
    """Return the latest Gemini-generated market summary (cached; no live generation)."""
    try:
        return get_market_summary_response()
    except Exception as exc:
        print(f"Error in get_market_summary: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/market-summary/gemini-ping")
def gemini_ping():
    """Quick Gemini connectivity test (official SDK pattern)."""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the server.",
        )
    try:
        from config import GEMINI_MODEL

        text = test_gemini_connection()
        return {"ok": True, "model": GEMINI_MODEL, "reply": text}
    except Exception as exc:
        print(f"Error in gemini_ping: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/market-summary/refresh")
def refresh_market_summary():
    """Generate a new market summary via Gemini and return the updated payload."""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the server.",
        )
    try:
        ok = generate_market_summary(force=True)
        if not ok:
            detail = get_last_generation_error() or (
                "Market summary generation failed. Check server logs."
            )
            raise HTTPException(status_code=500, detail=detail)
        return get_market_summary_response()
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in refresh_market_summary: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/todays-insight")
def get_todays_market_insight():
    """Provide a short narrative and key facts for the front page."""
    try:
        sectors = get_sector_performance_summary()
        indices = db.get_all_indices()
        status = _session_status_et()

        leaders = sorted(sectors, key=lambda s: s.get("change1D", 0), reverse=True)[:2] if sectors else []
        laggards = sorted(sectors, key=lambda s: s.get("change1D", 0))[:2] if sectors else []

        spx = next((i for i in indices if i.get("symbol") in ["SPX", "^GSPC"]), None)
        spx_change = spx.get("change_pct") if spx else None

        market_tone = "Neutral"
        if spx_change is not None:
            if spx_change > 0.5:
                market_tone = "Risk-On"
            elif spx_change < -0.5:
                market_tone = "Risk-Off"

        text = _build_insight_text(status, market_tone, spx_change, leaders, laggards)

        return {
            "status": status,
            "marketTone": market_tone,
            "leaders": leaders,
            "laggards": laggards,
            "spxChange": spx_change,
            "text": text,
            "last_updated": datetime.now().isoformat(),
        }
    except Exception as exc:
        print(f"Error in get_todays_market_insight: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/top-movers")
def get_top_movers(limit: int = 10):
    """Get top gaining and losing stocks today."""
    try:
        gainers = db.get_market_movers(category="gainer")[:limit]
        losers = db.get_market_movers(category="loser")[:limit]
        actives = db.get_market_movers(category="active")[:limit]

        if not (gainers or losers):
            gainers = db.get_all_stocks(order_by="change_1d DESC")[:limit]
            losers = db.get_all_stocks(order_by="change_1d ASC")[:limit]
            if not gainers or not losers:
                raise HTTPException(status_code=503, detail="Data not available")

            return {
                "gainers": [
                    {"ticker": s["ticker"], "name": s["name"], "price": s["price"], "change1D": s["change_1d"], "volume": s["volume"]}
                    for s in gainers
                ],
                "losers": [
                    {"ticker": s["ticker"], "name": s["name"], "price": s["price"], "change1D": s["change_1d"], "volume": s["volume"]}
                    for s in losers
                ],
            }

        return {
            "gainers": [
                {"ticker": s["ticker"], "name": s["name"], "price": s["price"], "change1D": s["change_percent"], "volume": s["volume"]}
                for s in gainers
            ],
            "losers": [
                {"ticker": s["ticker"], "name": s["name"], "price": s["price"], "change1D": s["change_percent"], "volume": s["volume"]}
                for s in losers
            ],
            "actives": [
                {"ticker": s["ticker"], "name": s["name"], "price": s["price"], "change1D": s["change_percent"], "volume": s["volume"]}
                for s in actives
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_top_movers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/standouts")
def get_standouts(limit: int = 10):
    """Return standout movers from cached market_movers."""
    try:
        gainers = db.get_market_movers(category="gainer")[:limit]
        losers = db.get_market_movers(category="loser")[:limit]
        actives = db.get_market_movers(category="active")[:limit]
        return {"gainers": gainers, "losers": losers, "actives": actives}
    except Exception as exc:
        print(f"Error in get_standouts: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/indices/intraday")
def get_indices_intraday(symbols: str, interval: str = "5min"):
    """Return intraday series for indices (5min). Cached for 60s."""
    try:
        symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
        now_ts = datetime.now().timestamp()
        result: Dict[str, List[Dict]] = {}
        for sym in symbol_list:
            fmp_symbol = INDEX_SYMBOL_MAP.get(sym.upper(), sym)
            cache_entry = _intraday_cache.get(sym)
            if cache_entry and now_ts - cache_entry["ts"] < 60:
                result[sym] = cache_entry["data"]
                continue
            series = fmp_client.get_index_intraday_chart(fmp_symbol, interval=interval)
            mapped = [
                {"date": item.get("date"), "value": item.get("close")}
                for item in series
                if item.get("date") is not None and item.get("close") is not None
            ]
            _intraday_cache[sym] = {"ts": now_ts, "data": mapped}
            result[sym] = mapped
        return result
    except Exception as exc:
        print(f"Error in get_indices_intraday: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/sparklines")
def get_sparklines(symbols: str, limit: int = 30):
    """Return simplified sparkline data (array of close prices) for multiple stock symbols."""
    try:
        symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        now_ts = datetime.now().timestamp()
        result: Dict[str, List[float]] = {}
        for sym in symbol_list:
            cache_entry = _sparkline_cache.get(sym)
            if cache_entry and now_ts - cache_entry["ts"] < 60:
                result[sym] = cache_entry["data"]
                continue
            series = fmp_client.get_intraday_chart(sym, interval="5min")
            closes = [item.get("close") for item in series[:limit] if item.get("close") is not None]
            closes = list(reversed(closes))
            _sparkline_cache[sym] = {"ts": now_ts, "data": closes}
            result[sym] = closes
        return result
    except Exception as exc:
        print(f"Error in get_sparklines: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
