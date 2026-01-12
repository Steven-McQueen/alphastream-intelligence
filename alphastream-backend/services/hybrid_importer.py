"""
Hybrid Data Importer
- Constituents from SP500Live (free)
- Real-time quotes from FMP (Starter)
- Sector + movers calculated locally
"""

import time
from datetime import datetime
from typing import Dict, List

import requests
import yfinance as yf

from database.db_manager import db
from services.fmp_client import fmp_client


BATCH_SIZE = 20


def fetch_sp500_list_from_sp500live() -> List[Dict]:
    """
    Fetch S&P 500 constituent list from SP500Live.co (ticker keyed dict).
    JSON format:
    {
      "AAPL": {...},
      "MSFT": {...},
      ...
    }
    """
    url = "https://www.sp500live.co/sp500_companies.json"

    try:
        print(f"  Fetching from {url}...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        raw_data = response.json()

        print(f"  Raw response type: {type(raw_data)}")

        if not isinstance(raw_data, dict):
            raise ValueError(f"Unexpected response format: {type(raw_data)}")

        print(f"  Processing {len(raw_data)} items...")

        constituents = []
        for ticker, data in raw_data.items():
            if not ticker or not isinstance(data, dict):
                continue
            constituents.append(
                {
                    "ticker": ticker.strip(),
                    "name": data.get("name", "").strip(),
                    "sector": data.get("sector", "").strip(),
                    "industry": data.get("industry", "").strip(),
                }
            )

        print(f"  [OK] Parsed {len(constituents)} valid constituents")
        return constituents

    except Exception as e:
        print(f"  [ERROR] Failed to fetch SP500Live list: {e}")
        import traceback

        traceback.print_exc()
        return []


def _to_float(val, default=0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _normalize_ticker_for_fmp(ticker: str) -> str:
    """
    Normalize tickers for FMP stable endpoints.
    Example: BRK.B -> BRK-B, BF.B -> BF-B
    """
    return ticker.replace(".", "-").strip()


def fetch_and_import_sp500_hybrid() -> int:
    """
    Hybrid S&P 500 import:
    1) Constituents from SP500Live
    2) Quotes from FMP
    3) Merge and store in DB
    """
    print("\n" + "=" * 60)
    print("HYBRID S&P 500 IMPORT (SP500Live + FMP)")
    print("=" * 60)

    start_time = time.time()
    success_count = 0

    try:
        print("Fetching S&P 500 list from SP500Live.co...")
        constituents = fetch_sp500_list_from_sp500live()
        if not constituents:
            print("[ERROR] Failed to fetch S&P 500 list")
            return 0
        print(f"[OK] Found {len(constituents)} S&P 500 constituents")

        symbols = [c["ticker"] for c in constituents if c.get("ticker")]
        # Map original -> normalized for FMP
        ticker_map = {sym: _normalize_ticker_for_fmp(sym) for sym in symbols}
        fmp_symbols = list(ticker_map.values())
        all_quotes: List[Dict] = []
        total_batches = (len(fmp_symbols) - 1) // BATCH_SIZE + 1
        print(f"Fetching quotes from FMP ({len(fmp_symbols)} stocks)...")
        for i in range(0, len(fmp_symbols), BATCH_SIZE):
            batch = fmp_symbols[i : i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            print(f"  Batch {batch_num}/{total_batches}...", end=" ")
            try:
                quotes = fmp_client.get_batch_quotes(batch)
                all_quotes.extend(quotes)
                print(f"[OK] {len(quotes)} quotes")
            except Exception as exc:
                print(f"[ERROR] Error: {exc}")
            time.sleep(0.3)  # stay under rate limits

        print(f"[OK] Total quotes fetched: {len(all_quotes)}")
        quote_map = {q.get("symbol"): q for q in all_quotes if q.get("symbol")}

        stocks_to_insert = []
        for c in constituents:
            ticker = c.get("ticker")
            if not ticker:
                continue
            fmp_symbol = ticker_map.get(ticker, ticker)
            quote = quote_map.get(fmp_symbol)
            if not quote:
                print(f"[WARN] No FMP quote for {ticker} (FMP symbol {fmp_symbol}), skipping...")
                continue

            stocks_to_insert.append(
                {
                    "ticker": ticker,
                    "name": c.get("name") or quote.get("name", ticker),
                    "sector": c.get("sector") or "",
                    "industry": c.get("industry") or "",
                    "price": _to_float(quote.get("price")),
                    "change_1d": _to_float(quote.get("changesPercentage")),
                    "change_1w": 0.0,
                    "change_1m": 0.0,
                    "change_1y": 0.0,
                    "change_5y": 0.0,
                    "change_ytd": 0.0,
                    "volume": int(_to_float(quote.get("volume"), 0)),
                    "high_1d": _to_float(quote.get("dayHigh")),
                    "low_1d": _to_float(quote.get("dayLow")),
                    "high_1m": None,
                    "low_1m": None,
                    "high_1y": _to_float(quote.get("yearHigh")),
                    "low_1y": _to_float(quote.get("yearLow")),
                    "high_5y": None,
                    "low_5y": None,
                    "pe_ratio": _to_float(quote.get("pe"), None),
                    "eps": _to_float(quote.get("eps"), None),
                    "dividend_yield": 0.0,
                    "market_cap": _to_float(quote.get("marketCap")),
                    "shares_outstanding": _to_float(quote.get("sharesOutstanding"), None),
                    "net_profit_margin": None,  # Populated from profile/key-metrics
                    "gross_margin": None,       # Populated from profile/key-metrics
                    "roe": None,                # Populated from profile/key-metrics
                    "revenue_ttm": None,
                    "beta": None,               # Populated from profile
                    "institutional_ownership": None,
                    "debt_to_equity": None,
                    "year_founded": None,
                    "website": None,
                    "city": None,
                    "state": None,
                    "zip": None,
                    "weight": 0.0,
                    "last_updated": datetime.now().isoformat(),
                    "data_source": "hybrid_sp500live_fmp",
                    "is_sp500": 1,
                }
            )

        if stocks_to_insert:
            success_count = db.insert_stocks_bulk(stocks_to_insert)

        duration = time.time() - start_time
        print("=" * 60)
        print("[OK] HYBRID S&P 500 IMPORT COMPLETE")
        print(f"   Stocks updated: {success_count}/{len(constituents)}")
        print(f"   Duration: {duration:.2f}s")
        print("=" * 60)

        db.log_refresh(
            stocks_updated=success_count,
            data_source="hybrid_sp500live_fmp",
            success=True,
            duration=duration,
        )
        return success_count
    except Exception as exc:
        duration = time.time() - start_time
        print(f"[ERROR] Import failed: {exc}")
        db.log_refresh(
            stocks_updated=0,
            data_source="hybrid_sp500live_fmp",
            success=False,
            duration=duration,
            error_msg=str(exc),
        )
        return 0


def fetch_and_import_indices_from_fmp() -> int:
    """
    Fetch market indices - use yfinance directly (FMP Starter not supported for indices).
    """
    print("\nFetching market indices (using yfinance - FMP doesn't support indices)...")
    return fetch_and_import_indices_from_yfinance()


def fetch_and_import_indices_from_yfinance() -> int:
    """
    Fetch market indices from yfinance
    """
    print("  Using yfinance for market indices...")

    indices = {
        "^GSPC": ("SPX", "S&P 500"),
        "^IXIC": ("NDX", "Nasdaq Composite"),
        "^DJI": ("DJI", "Dow Jones Industrial Average"),
        "^RUT": ("RUT", "Russell 2000"),
        "^VIX": ("VIX", "CBOE Volatility Index"),
    }

    success_count = 0

    for yf_symbol, (our_symbol, name) in indices.items():
        try:
            print(f"  Fetching {our_symbol}...", end=" ")
            ticker = yf.Ticker(yf_symbol)
            hist = ticker.history(period="1mo")
            if len(hist) >= 2:
                current = float(hist["Close"].iloc[-1])
                previous = float(hist["Close"].iloc[-2])
                change = current - previous
                change_pct = (change / previous) * 100
                db.insert_or_update_index(
                    symbol=our_symbol,
                    name=name,
                    value=round(current, 2),
                    change=round(change, 2),
                    change_pct=round(change_pct, 2),
                )
                print(f"[OK] {current:.2f} ({change_pct:+.2f}%)")
                success_count += 1
            else:
                print(f"[ERROR] Insufficient data (got {len(hist)} rows)")
        except Exception as e:
            print(f"[ERROR] Error: {e}")

    return success_count


def calculate_sector_performance() -> int:
    """Calculate sector performance using cached stocks."""
    print("\nCalculating sector performance from stocks...")
    try:
        stocks = db.get_all_stocks()
        if not stocks:
            print("[ERROR] No stocks in database")
            return 0

        sector_totals = {}
        sector_counts = {}
        for stock in stocks:
            sector = stock.get("sector") or "Unknown"
            change = stock.get("change_1d", 0) or 0
            sector_totals[sector] = sector_totals.get(sector, 0.0) + change
            sector_counts[sector] = sector_counts.get(sector, 0) + 1

        for sector, total_change in sector_totals.items():
            count = sector_counts.get(sector, 1)
            avg_change = total_change / count if count else 0.0
            db.insert_or_update_sector_performance(
                sector=sector, change_percent=round(avg_change, 2)
            )
            print(f"[OK] {sector}: {avg_change:+.2f}% (avg of {count} stocks)")

        return len(sector_totals)
    except Exception as exc:
        print(f"[ERROR] Failed to calculate sectors: {exc}")
        return 0


def fetch_and_import_sector_performance_from_fmp(date: str = None, exchange: str = None) -> int:
    """Fetch sector performance from FMP stable endpoint."""
    print("\nFetching sector performance from FMP...")
    try:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        rows = fmp_client.get_sector_performance_snapshot(date=date, exchange=exchange)
        if not rows:
            print("[ERROR] No sector data received from FMP")
            return 0
        count = 0
        for r in rows:
            sector = r.get("sector")
            avg = r.get("averageChange")
            if sector is None or avg is None:
                continue
            db.insert_or_update_sector_performance(sector=sector, change_percent=float(avg))
            count += 1
            print(f"[OK] {sector}: {avg:+.2f}%")
        return count
    except Exception as exc:
        print(f"[ERROR] Failed to fetch sectors from FMP: {exc}")
        return 0


def fetch_and_import_market_movers_from_fmp(limit: int = 10) -> int:
    """Fetch market movers (gainers/losers) from FMP stable endpoints."""
    print("\nFetching market movers from FMP...")
    try:
        db.clear_market_movers()
        gainers = (fmp_client.get_biggest_gainers() or [])[:limit]
        losers = (fmp_client.get_biggest_losers() or [])[:limit]

        for s in gainers:
            db.insert_market_mover(
                ticker=s.get("symbol"),
                name=s.get("name"),
                price=_to_float(s.get("price")),
                change=_to_float(s.get("change")),
                change_percent=_to_float(s.get("changesPercentage")),
                volume=s.get("volume") or 0,
                category="gainer",
                market_cap=s.get("marketCap"),
            )

        for s in losers:
            db.insert_market_mover(
                ticker=s.get("symbol"),
                name=s.get("name"),
                price=_to_float(s.get("price")),
                change=_to_float(s.get("change")),
                change_percent=_to_float(s.get("changesPercentage")),
                volume=s.get("volume") or 0,
                category="loser",
                market_cap=s.get("marketCap"),
            )

        print(f"[OK] Gainers: {len(gainers)}, Losers: {len(losers)}")
        return len(gainers) + len(losers)
    except Exception as exc:
        print(f"[ERROR] Failed to fetch market movers: {exc}")
        return 0


def refresh_all_hybrid_data() -> Dict[str, int]:
    """Refresh all hybrid-backed datasets."""
    print("\n" + "=" * 60)
    print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - HYBRID DATA REFRESH")
    print("=" * 60)

    stocks_count = fetch_and_import_sp500_hybrid()
    indices_count = fetch_and_import_indices_from_fmp()
    if indices_count == 0:
        print("  FMP indices failed, using yfinance fallback...")
        indices_count = fetch_and_import_indices_from_yfinance()
    sectors_count = fetch_and_import_sector_performance_from_fmp()
    movers_count = fetch_and_import_market_movers_from_fmp(limit=10)

    print("=" * 60)
    print("[OK] REFRESH COMPLETE")
    print(f"   Stocks: {stocks_count}")
    print(f"   Indices: {indices_count}")
    print(f"   Sectors: {sectors_count}")
    print(f"   Market Movers: {movers_count}")
    print("=" * 60)

    return {
        "stocks": stocks_count,
        "indices": indices_count,
        "sectors": sectors_count,
        "movers": movers_count,
    }

