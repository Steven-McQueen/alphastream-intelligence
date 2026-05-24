"""Watchlist endpoints (/api/watchlist/*)."""

from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import APIRouter, HTTPException

from database.db_manager import db
from services.fmp_client import fmp_client
from services.price_history_importer import compute_return_from_eod

router = APIRouter(prefix="/api/watchlist")

# In-memory cache for watchlist metrics (TTL 5 min)
_metrics_cache: dict = {}
_METRICS_TTL = 300  # seconds

def _get_cached_metrics(ticker: str) -> dict | None:
    import time
    entry = _metrics_cache.get(ticker)
    if entry and (time.time() - entry["ts"]) < _METRICS_TTL:
        return entry["data"]
    return None


def _fetch_metrics_for_ticker(ticker: str) -> dict:
    """Fetch metrics from DB first, then FMP as fallback. Cache result."""
    import time

    cached = _get_cached_metrics(ticker)
    if cached is not None:
        return cached

    stock = db.get_stock(ticker)

    # Try to get metrics from cached stock data first (fast path)
    pe_ratio = stock.get("pe_ratio") if stock else None
    roe = stock.get("roe") if stock else None
    gross_margin = stock.get("gross_margin") if stock else None
    net_margin = stock.get("net_profit_margin") if stock else None
    beta = stock.get("beta") if stock else None
    volume = stock.get("volume") if stock else None
    market_cap = stock.get("market_cap") if stock else None

    # If key metrics missing, fetch from FMP (slow path)
    needs_fmp = (roe is None and gross_margin is None and net_margin is None)
    if needs_fmp:
        try:
            metrics = fmp_client.get_key_metrics(ticker, period="annual", limit=1)
            if metrics and len(metrics) > 0:
                roe = roe or metrics[0].get("returnOnEquity")

            ratios = fmp_client.get_ratios(ticker, period="annual", limit=1)
            if ratios and len(ratios) > 0:
                r = ratios[0]
                gross_margin = gross_margin or r.get("grossProfitMargin")
                net_margin = net_margin or r.get("netProfitMargin")
                pe_ratio = pe_ratio or r.get("priceToEarningsRatio")

            profile = fmp_client.get_company_profile(ticker)
            if profile and len(profile) > 0:
                p = profile[0]
                beta = beta or p.get("beta")
                if not volume:
                    volume = p.get("volAvg")
        except Exception as e:
            print(f"[WATCHLIST] FMP fallback error for {ticker}: {e}")

    change_1w = compute_return_from_eod(ticker, window_days=7)

    result = {
        "ticker": ticker,
        "name": stock.get("name") if stock else ticker,
        "sector": stock.get("sector") if stock else None,
        "industry": stock.get("industry") if stock else None,
        "change1D": stock.get("change_1d") if stock else None,
        "change1W": change_1w,
        "price": stock.get("price") if stock else None,
        "marketCap": market_cap,
        "peRatio": pe_ratio,
        "roe": roe,
        "grossMargin": gross_margin,
        "netMargin": net_margin,
        "beta": beta,
        "volume": volume,
    }

    _metrics_cache[ticker] = {"ts": time.time(), "data": result}
    return result


@router.get("/prices")
def get_watchlist_prices(tickers: str):
    """Return current price, metrics, and 1W return for provided tickers (CSV).

    Uses concurrent fetching for all tickers in parallel for fast response.
    """
    try:
        if not tickers:
            return []
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]

        # Fetch all tickers concurrently
        results = []
        with ThreadPoolExecutor(max_workers=min(len(ticker_list), 8)) as executor:
            future_to_ticker = {
                executor.submit(_fetch_metrics_for_ticker, t): t
                for t in ticker_list
            }
            for future in as_completed(future_to_ticker):
                try:
                    results.append(future.result())
                except Exception as e:
                    t = future_to_ticker[future]
                    print(f"[WATCHLIST] Error fetching {t}: {e}")
                    results.append({"ticker": t, "name": t, "error": True})

        # Preserve original order
        order = {t: i for i, t in enumerate(ticker_list)}
        results.sort(key=lambda r: order.get(r["ticker"], 999))

        return results
    except Exception as exc:
        print(f"Error in get_watchlist_prices: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
