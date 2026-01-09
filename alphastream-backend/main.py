from datetime import datetime, timedelta
from typing import List, Dict, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from clients.finnhub_client import FinnhubRateLimitError, finnhub
from database.db_manager import db
from models import MarketNewsItem, MarketState, Portfolio, Stock
from services.market import get_market_state
from services.portfolio import get_mock_portfolio
from services.refresh_scheduler import start_scheduler_background
from services.news_importer import refresh_general_news, refresh_ticker_news
from services.price_history_importer import (
    get_or_fetch_intraday,
    get_or_fetch_eod,
    compute_return_from_eod,
)
from services.earnings_importer import refresh_earnings_window
from services.sector_importer import get_sector_performance_summary
from services.fmp_client import fmp_client

LIVE_CACHE_SECONDS = 2
_live_quote_cache: Dict[str, Dict] = {}
from services.refresh_scheduler import is_market_hours

app = FastAPI(
    title="AlphaStream API",
    description="Backend for AlphaStream Intelligence Terminal",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/macro/latest")
async def get_latest_macro_snapshot():
    """
    Get latest values for Today's Snapshot
    Returns: SPX, NDX, DJI, RUT, US10Y, VIX with current values and changes
    """
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
                "change_percent": spx_row.get("change_pct")
                or spx_row.get("change_percent"),
            },
            "NDX": {
                "value": ndx_row.get("value"),
                "change_percent": ndx_row.get("change_pct")
                or ndx_row.get("change_percent"),
            },
            "DJI": {
                "value": dji_row.get("value"),
                "change_percent": dji_row.get("change_pct")
                or dji_row.get("change_percent"),
            },
            "RUT": {
                "value": rut_row.get("value"),
                "change_percent": rut_row.get("change_pct")
                or rut_row.get("change_percent"),
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

@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup"""
    start_scheduler_background()


# ============================================================================
# ROOT / HEALTH
# ============================================================================

@app.get("/")
def root():
    try:
        return {"name": "AlphaStream API", "version": "0.1.0", "status": "running"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in root: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    """Health check endpoint"""
    try:
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "database": "connected",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in health_check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/status")
def get_market_status():
    """
    Market session status derived from refresh_scheduler.is_market_hours().
    Returns current server time, status text, and boolean isMarketOpen.
    """
    try:
        now = datetime.utcnow()
        open_now = is_market_hours()
        status = "Open" if open_now else "Closed"
        return {
            "status": status,
            "isMarketOpen": open_now,
            "serverTime": now.isoformat(),
        }
    except Exception as exc:
        print(f"Error in get_market_status: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


def _live_quote(symbol: str) -> Dict:
    """
    Fetch live quote with short TTL cache to avoid duplicate calls within 2s window.
    For indices, attempts stable quote; if missing data, falls back to 5-min intraday last close.
    """
    now_ts = datetime.utcnow().timestamp()
    cache = _live_quote_cache.get(symbol)
    if cache and now_ts - cache["ts"] < LIVE_CACHE_SECONDS:
        return cache["data"]

    data = fmp_client.get_quote(symbol)
    if (not data or data.get("price") is None) and symbol.startswith("^"):
        # fallback to intraday close
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


@app.get("/api/live/quote")
def get_live_quote(symbol: str):
    """
    Live quote (2s TTL cache). Supports indices (caret symbols) and equities.
    """
    try:
        return _live_quote(symbol)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in get_live_quote: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================================
# UNIVERSE / SCREENER ENDPOINTS
# ============================================================================

@app.get("/api/universe/core")
def get_universe_core():
    """
    Get all S&P 500 stocks from database
    Returns: List of all stocks with full data
    """
    try:
        stocks = db.get_all_stocks(order_by="market_cap DESC")
        if not stocks:
            raise HTTPException(status_code=503, detail="Data not available")
        result = []
        for stock in stocks:
            result.append(
                {
                    "ticker": stock["ticker"],
                    "name": stock["name"],
                    "sector": stock["sector"],
                    "industry": stock["industry"],
                    "price": stock["price"],
                    "change1D": stock["change_1d"],
                    "change1W": stock["change_1w"],
                    "change1M": stock["change_1m"],
                    "change1Y": stock["change_1y"],
                    "volume": stock["volume"],
                    "peRatio": stock["pe_ratio"],
                    "eps": stock["eps"],
                    "dividendYield": stock["dividend_yield"],
                    "marketCap": stock["market_cap"],
                    "netProfitMargin": stock["net_profit_margin"],
                    "grossMargin": stock["gross_margin"],
                    "roe": stock["roe"],
                    "revenue": stock["revenue_ttm"],
                    "beta": stock["beta"],
                    "institutionalOwnership": stock["institutional_ownership"],
                    "yearFounded": stock["year_founded"],
                    "website": stock["website"],
                    "updatedAt": stock["last_updated"],
                }
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_universe_core: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/universe/search")
def search_universe(q: str = Query(..., min_length=1)):
    """
    Search stocks by ticker or name
    """
    try:
        stocks = db.search_stocks(q)
        if not stocks:
            raise HTTPException(status_code=503, detail="Data not available")
        result = []
        for stock in stocks:
            result.append(
                {
                    "ticker": stock["ticker"],
                    "name": stock["name"],
                    "sector": stock["sector"],
                    "industry": stock["industry"],
                    "price": stock["price"],
                    "change1D": stock["change_1d"],
                    "change1W": stock["change_1w"],
                    "change1M": stock["change_1m"],
                    "change1Y": stock["change_1y"],
                    "volume": stock["volume"],
                    "peRatio": stock["pe_ratio"],
                    "eps": stock["eps"],
                    "dividendYield": stock["dividend_yield"],
                    "marketCap": stock["market_cap"],
                    "netProfitMargin": stock["net_profit_margin"],
                    "grossMargin": stock["gross_margin"],
                    "roe": stock["roe"],
                    "revenue": stock["revenue_ttm"],
                    "beta": stock["beta"],
                    "institutionalOwnership": stock["institutional_ownership"],
                    "yearFounded": stock["year_founded"],
                    "website": stock["website"],
                    "updatedAt": stock["last_updated"],
                }
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in search_universe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/{ticker}")
def get_stock(ticker: str):
    """
    Get detailed information for a specific stock
    """
    try:
        stock = db.get_stock(ticker.upper())
        if not stock:
            raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")

        return {
            "ticker": stock["ticker"],
            "name": stock["name"],
            "sector": stock["sector"],
            "industry": stock["industry"],
            "price": stock["price"],
            "change1D": stock["change_1d"],
            "change1W": stock["change_1w"],
            "change1M": stock["change_1m"],
            "change1Y": stock["change_1y"],
            "change5Y": stock["change_5y"],
            "changeYTD": stock["change_ytd"],
            "volume": stock["volume"],
            "high1D": stock["high_1d"],
            "low1D": stock["low_1d"],
            "high1M": stock["high_1m"],
            "low1M": stock["low_1m"],
            "high1Y": stock["high_1y"],
            "low1Y": stock["low_1y"],
            "high5Y": stock["high_5y"],
            "low5Y": stock["low_5y"],
            "peRatio": stock["pe_ratio"],
            "eps": stock["eps"],
            "dividendYield": stock["dividend_yield"],
            "marketCap": stock["market_cap"],
            "sharesOutstanding": stock["shares_outstanding"],
            "netProfitMargin": stock["net_profit_margin"],
            "grossMargin": stock["gross_margin"],
            "roe": stock["roe"],
            "revenue": stock["revenue_ttm"],
            "beta": stock["beta"],
            "institutionalOwnership": stock["institutional_ownership"],
            "debtToEquity": stock["debt_to_equity"],
            "yearFounded": stock["year_founded"],
            "website": stock["website"],
            "city": stock["city"],
            "state": stock["state"],
            "zip": stock["zip"],
            "updatedAt": stock["last_updated"],
            "dataSource": stock["data_source"],
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MARKET DATA ENDPOINTS
# ============================================================================

@app.get("/api/market/sectors")
def get_sector_performance():
    """Calculate sector performance by aggregating stocks in database"""
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

        # Fallback to cached table if no history yet
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


def _session_status_et() -> str:
    """Return session status in ET: Pre-Market / Open / After-Hours / Closed."""
    now = datetime.utcnow()
    # naive split: 14:30-21:00 UTC ~ 9:30-16:00 ET; pre 12:00-14:30 ET
    # For simplicity using UTC windows
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


@app.get("/api/market/todays-insight")
def get_todays_market_insight():
    """
    Provide a short narrative and key facts for the front page.
    """
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

        leader_text = ", ".join([f"{l['sector']} ({l.get('change1D',0):+.2f}%)" for l in leaders]) if leaders else "no clear leaders"
        laggard_text = ", ".join([f"{l['sector']} ({l.get('change1D',0):+.2f}%)" for l in laggards]) if laggards else "no clear laggards"

        text = (
            f"Markets are {status.lower()} with a {market_tone.lower()} tone. "
            f"Leaders: {leader_text}; Laggards: {laggard_text}."
        )

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


def _normalize_ticker_dot_hyphen(t: str) -> str:
    return t.replace(".", "-").upper()


def _next_friday(start_date: datetime.date) -> datetime.date:
    # weekday: Monday=0 ... Sunday=6; Friday=4
    days_ahead = (4 - start_date.weekday()) % 7
    return start_date + timedelta(days=days_ahead)


@app.get("/api/earnings")
def get_earnings(
    mode: str = "upcoming",
    window: str = "week",
    tickers: str = None,
    limit: int = 8,
    offset: int = 0,
):
    """
    Earnings calendar filtered by mode/window and optional tickers (CSV).
    mode: upcoming | recent
    window: today | week
    Pagination: limit/offset (defaults to 8/0)
    """
    try:
        today = datetime.now().date()
        if mode == "recent":
            if window == "today":
                start = end = today
            else:  # past week
                start = today - timedelta(days=7)
                end = today
        else:  # upcoming
            if window == "today":
                start = end = today
            else:  # this market week to Friday
                start = today
                end = _next_friday(today)

        start_str = start.strftime("%Y-%m-%d")
        end_str = end.strftime("%Y-%m-%d")

        tickers_list = [t.strip().upper() for t in tickers.split(",")] if tickers else None

        # Name map from stocks for enrichment (no universe filtering)
        all_stocks = db.get_all_stocks()
        name_map = {}
        for s in all_stocks:
            if s.get("ticker"):
                raw = s["ticker"].upper()
                name_map[raw] = s.get("name") or raw
                name_map[_normalize_ticker_dot_hyphen(raw)] = s.get("name") or raw

        rows = db.get_earnings_calendar(from_date=start_str, to_date=end_str)

        # Optional ticker filter
        if tickers_list:
            rows = [r for r in rows if (r.get("ticker") or "").upper() in tickers_list]

        # If empty, attempt refresh then re-filter
        if not rows:
            refresh_earnings_window(start_str, end_str, tickers=tickers_list)
            rows = db.get_earnings_calendar(from_date=start_str, to_date=end_str)
            if tickers_list:
                rows = [r for r in rows if (r.get("ticker") or "").upper() in tickers_list]

        # Keep only entries with a valid EPS estimate (not null)
        filtered = [r for r in rows if r.get("eps_estimate") is not None]

        # Sort: upcoming -> ascending date; recent -> descending date
        filtered.sort(key=lambda r: r.get("report_date") or r.get("date") or "", reverse=(mode == "recent"))

        total = len(filtered)
        paged = filtered[offset : offset + limit]

        # Enrich company name
        for r in paged:
            tk = (r.get("ticker") or "").upper()
            r["company_name"] = name_map.get(tk) or name_map.get(_normalize_ticker_dot_hyphen(tk)) or r.get("company_name") or tk

        return {"items": paged, "total": total}
    except Exception as exc:
        print(f"Error in get_earnings: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/market/top-movers")
def get_top_movers(limit: int = 10):
    """Get top gaining and losing stocks today"""
    try:
        gainers = db.get_market_movers(category="gainer")[:limit]
        losers = db.get_market_movers(category="loser")[:limit]
        actives = db.get_market_movers(category="active")[:limit]

        if not (gainers or losers):
            # Fallback to derived movers from stock table
            gainers = db.get_all_stocks(order_by="change_1d DESC")[:limit]
            losers = db.get_all_stocks(order_by="change_1d ASC")[:limit]
            if not gainers or not losers:
                raise HTTPException(status_code=503, detail="Data not available")

            return {
                "gainers": [
                    {
                        "ticker": s["ticker"],
                        "name": s["name"],
                        "price": s["price"],
                        "change1D": s["change_1d"],
                        "volume": s["volume"],
                    }
                    for s in gainers
                ],
                "losers": [
                    {
                        "ticker": s["ticker"],
                        "name": s["name"],
                        "price": s["price"],
                        "change1D": s["change_1d"],
                        "volume": s["volume"],
                    }
                    for s in losers
                ],
            }

        return {
            "gainers": [
                {
                    "ticker": s["ticker"],
                    "name": s["name"],
                    "price": s["price"],
                    "change1D": s["change_percent"],
                    "volume": s["volume"],
                }
                for s in gainers
            ],
            "losers": [
                {
                    "ticker": s["ticker"],
                    "name": s["name"],
                    "price": s["price"],
                    "change1D": s["change_percent"],
                    "volume": s["volume"],
                }
                for s in losers
            ],
            "actives": [
                {
                    "ticker": s["ticker"],
                    "name": s["name"],
                    "price": s["price"],
                    "change1D": s["change_percent"],
                    "volume": s["volume"],
                }
                for s in actives
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_top_movers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/watchlist/prices")
def get_watchlist_prices(tickers: str):
    """
    Return current price and 1W return for provided tickers (CSV).
    """
    try:
        if not tickers:
            return []
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        results = []
        for t in ticker_list:
            stock = db.get_stock(t)
            if not stock:
                # fallback: try quote
                quote = db.get_all_stocks(order_by="market_cap DESC")
                stock = next((s for s in quote if s.get("ticker") == t), None)
            change_1w = compute_return_from_eod(t, window_days=7)
            results.append(
                {
                    "ticker": t,
                    "name": stock.get("name") if stock else t,
                    "sector": stock.get("sector") if stock else None,
                    "change1D": stock.get("change_1d") if stock else None,
                    "change1W": change_1w,
                    "price": stock.get("price") if stock else None,
                }
            )
        return results
    except Exception as exc:
        print(f"Error in get_watchlist_prices: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/market/standouts")
def get_standouts(limit: int = 10):
    """
    Return standout movers (gainers/losers/actives) from cached market_movers.
    """
    try:
        gainers = db.get_market_movers(category="gainer")[:limit]
        losers = db.get_market_movers(category="loser")[:limit]
        actives = db.get_market_movers(category="active")[:limit]
        return {"gainers": gainers, "losers": losers, "actives": actives}
    except Exception as exc:
        print(f"Error in get_standouts: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# Simple in-memory cache for intraday indices
_intraday_cache: Dict[str, Dict] = {}


@app.get("/api/market/indices/intraday")
def get_indices_intraday(symbols: str, interval: str = "5min"):
    """
    Return intraday series for indices (5min). Cached for 60s.
    Response shape: {symbol: [{date, value}]}
    """
    try:
        symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
        now_ts = datetime.now().timestamp()
        result: Dict[str, List[Dict]] = {}
        for sym in symbol_list:
            cache_entry = _intraday_cache.get(sym)
            if cache_entry and now_ts - cache_entry["ts"] < 60:
                result[sym] = cache_entry["data"]
                continue
            series = fmp_client.get_index_intraday_chart(sym, interval=interval)
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


# ============================================================================
# PORTFOLIO & NEWS (existing behavior)
# ============================================================================

@app.get("/api/market-state", response_model=MarketState)
def market_state():
    try:
        result = get_market_state()
        if not result:
            raise HTTPException(status_code=503, detail="Data not available")
        return result
    except FinnhubRateLimitError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        print(f"Error in market_state: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/portfolio", response_model=Portfolio)
def portfolio():
    try:
        result = get_mock_portfolio()
        if not result:
            raise HTTPException(status_code=503, detail="Data not available")
        return result
    except Exception as exc:
        print(f"Error in portfolio: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


def _news_row_to_item(row: dict, category: str, tickers: List[str]) -> MarketNewsItem:
    return MarketNewsItem(
        id=row.get("url") or row.get("title", ""),
        headline=row.get("title", ""),
        summary=row.get("snippet", ""),
        source=row.get("site", ""),
        publishedAt=row.get("published_date") or datetime.now().isoformat(),
        category=category,
        sentiment="neutral",
        tickers=tickers,
        url=row.get("url"),
    )


@app.get("/api/news", response_model=List[MarketNewsItem])
def news(category: str = "general"):
    try:
        articles = db.get_news_general(limit=20)
        if not articles:
            refresh_general_news(limit=50)
            articles = db.get_news_general(limit=20)
        return [
            _news_row_to_item(row, category="general", tickers=[])
            for row in articles
        ]
    except Exception as exc:
        print(f"Error in news: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/news/{ticker}")
def company_news(ticker: str):
    """
    Get news for a specific ticker.
    Returns format expected by frontend: symbol, publishedDate, publisher, title, image, site, text, url
    """
    try:
        symbol = ticker.upper()
        articles = db.get_news_for_ticker(symbol, limit=20)
        if not articles:
            refresh_ticker_news([symbol], limit=20)
            articles = db.get_news_for_ticker(symbol, limit=20)
        
        # Return format expected by frontend StockNews component
        return [
            {
                "symbol": symbol,
                "publishedDate": row.get("published_date") or "",
                "publisher": row.get("publisher") or row.get("site") or "",
                "title": row.get("title") or "",
                "image": row.get("image") or "",
                "site": row.get("site") or "",
                "text": row.get("snippet") or "",
                "url": row.get("url") or "",
            }
            for row in articles
        ]
    except Exception as exc:
        print(f"Error in company_news: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================================
# CHART DATA
# ============================================================================


@app.get("/api/stock/{ticker}/chart")
def get_stock_chart(ticker: str, timeframe: str = "1day", limit: int = 500):
    """
    Get cached chart data for a ticker and timeframe.
    Timeframes supported:
      - intraday: 5min, 15min, 30min, 1hour
      - eod: 1day
    """
    symbol = ticker.upper()
    tf = timeframe.lower()
    try:
        if tf in ["5min", "15min", "30min", "1hour"]:
            bars = get_or_fetch_intraday(symbol, interval=tf, limit=limit)
        elif tf in ["1day", "1d", "eod"]:
            bars = get_or_fetch_eod(symbol, limit=limit)
        else:
            raise HTTPException(status_code=400, detail="Unsupported timeframe")

        return [
            {
                "date": bar.get("bar_time"),
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": bar.get("volume"),
                "timeframe": bar.get("timeframe"),
            }
            for bar in bars
        ]
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in get_stock_chart: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/stock/{ticker}/profile")
def get_stock_profile(ticker: str):
    """
    Get company profile including description, logo, CEO, employees, etc.
    Returns data from FMP /stable/profile endpoint.
    """
    try:
        symbol = ticker.upper()
        print(f"[DATA] Fetching profile for {symbol}")
        profile_data = fmp_client.get_company_profile(symbol)
        
        if not profile_data or len(profile_data) == 0:
            print(f"[WARN] No profile data returned for {symbol}")
            raise HTTPException(status_code=404, detail=f"Profile not found for {ticker}")
        
        profile = profile_data[0]
        
        # Ensure all required fields are present (with defaults)
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
        
        print(f"[OK] Profile fetched for {symbol}: {result.get('companyName')}")
        return result
        
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error in get_stock_profile for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ============================================================================
# SYSTEM / MONITORING
# ============================================================================

@app.get("/api/data/status")
def get_data_status():
    """Get database refresh status and data age"""
    try:
        age_minutes = db.get_data_age()
        refresh_history = db.get_refresh_history(limit=5)
        if age_minutes is None and refresh_history is None:
            raise HTTPException(status_code=503, detail="Data not available")
        return {
            "data_age_minutes": round(age_minutes, 2) if age_minutes else None,
            "last_refresh": refresh_history if refresh_history else None,
            "recent_refreshes": refresh_history,
            "total_stocks": len(db.get_all_stocks()),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_data_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MACRO DATA ENDPOINTS
# ============================================================================

@app.get("/api/macro/indices")
def get_market_indices():
    """Get current market indices (SPX, NDX, DJI, RUT, VIX)"""
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


@app.get("/api/macro/indicators")
def get_macro_indicators():
    """Get current macro indicators (yields, CPI, GDP, unemployment, DXY)"""
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


@app.get("/api/macro/treasury-history")
def get_treasury_history(days: int = 365):
    """Get 12 months of US 10Y and 2Y treasury yield history for chart"""
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


@app.get("/api/macro/cpi-history")
def get_cpi_history(months: int = 12):
    """Get 12 months of CPI history for chart"""
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


@app.get("/api/macro/vix-history")
def get_vix_history(days: int = 365):
    """Get 12 months of VIX history for chart"""
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


@app.get("/api/data/status/summary")
def get_data_status_summary():
    """Get database refresh status (summary)"""
    try:
        age_minutes = db.get_data_age()
        refresh_history = db.get_refresh_history(limit=5)
        if age_minutes is None and refresh_history is None:
            raise HTTPException(status_code=503, detail="Data not available")
        return {
            "data_age_minutes": round(age_minutes, 2) if age_minutes else None,
            "recent_refreshes": refresh_history,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_data_status_summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/macro/alternative-assets")
async def get_alternative_assets():
    """
    Get all alternative assets (crypto, commodities, currencies).
    Returns NULL values when fetch failed; no synthetic data.
    """
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


@app.get("/api/macro/ticker-all")
async def get_ticker_all():
    """
    Get combined ticker data for global ticker.
    Returns NULLs when data is missing; no fallbacks or synthetic values.
    """
    try:
        ticker_items = []

        # Market indices
        try:
            indices = db.get_all_indices()
            for idx in indices:
                ticker_items.append(
                    {
                        "symbol": idx.get("symbol"),
                        "name": idx.get("name"),
                        "value": idx.get("value"),
                        "change": idx.get("change"),
                        "changePercent": idx.get("change_pct") or idx.get("change_percent"),
                        "category": "equity",
                        "displayFormat": "decimal",
                        "error": None,
                    }
                )
        except Exception as e:
            print(f"[ERROR] Failed to fetch indices for ticker: {e}")

        # Treasury yields (US10Y, US2Y)
        try:
            treasury = db.get_treasury_history(days=2)
            if treasury and len(treasury) >= 2:
                latest = treasury[-1]
                prev = treasury[-2]

                if latest.get("yield_10y") is not None and prev.get("yield_10y") is not None:
                    us10y_change = latest["yield_10y"] - prev["yield_10y"]
                    us10y_change_pct = (us10y_change / prev["yield_10y"]) * 100 if prev["yield_10y"] else None
                    ticker_items.append(
                        {
                            "symbol": "US10Y",
                            "name": "10-Year Treasury",
                            "value": latest["yield_10y"],
                            "change": round(us10y_change, 3) if us10y_change is not None else None,
                            "changePercent": round(us10y_change_pct, 2) if us10y_change_pct is not None else None,
                            "category": "macro",
                            "displayFormat": "percent",
                            "error": None,
                        }
                    )

                if latest.get("yield_2y") is not None and prev.get("yield_2y") is not None:
                    us2y_change = latest["yield_2y"] - prev["yield_2y"]
                    us2y_change_pct = (us2y_change / prev["yield_2y"]) * 100 if prev["yield_2y"] else None
                    ticker_items.append(
                        {
                            "symbol": "US2Y",
                            "name": "2-Year Treasury",
                            "value": latest["yield_2y"],
                            "change": round(us2y_change, 3) if us2y_change is not None else None,
                            "changePercent": round(us2y_change_pct, 2) if us2y_change_pct is not None else None,
                            "category": "macro",
                            "displayFormat": "percent",
                            "error": None,
                        }
                    )
        except Exception as e:
            print(f"[ERROR] Failed to fetch treasury data for ticker: {e}")

        # Alternative assets (crypto, commodities, currencies)
        try:
            alt_assets = db.get_all_alternative_assets()
            for asset in alt_assets:
                ticker_items.append(
                    {
                        "symbol": asset.get("symbol"),
                        "name": asset.get("name"),
                        "value": asset.get("value"),
                        "change": asset.get("change"),
                        "changePercent": asset.get("change_percent"),
                        "category": asset.get("asset_type"),
                        "displayFormat": "currency" if asset.get("asset_type") != "currency" else "decimal",
                        "error": asset.get("fetch_error"),
                    }
                )
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
