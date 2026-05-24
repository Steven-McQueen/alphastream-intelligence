"""
Universe Importer - Populates the symbols table with all tradeable securities from FMP.

This module handles:
1. Fetching full stock list from FMP (5,000-10,000+ symbols)
2. Fetching S&P 500 constituents to set tier flags
3. Populating the symbols master table
4. Refreshing quotes for tiered symbols
"""

import time
from datetime import datetime
from typing import Dict, List

import requests

from database.db_manager import db
from services.fmp_client import fmp_client


def fetch_and_import_full_universe() -> int:
    """
    Fetch all tradeable securities from FMP and populate the symbols table.
    Should be run once daily during off-market hours.

    Returns: Number of symbols upserted
    """
    print("\n[UNIVERSE] Starting full universe import...")
    start_time = time.time()

    # 1. Fetch full stock list from FMP
    stock_list = fmp_client.get_stock_list()

    if not stock_list:
        print("[UNIVERSE] No symbols returned from FMP stock list")
        return 0

    print(f"[UNIVERSE] Fetched {len(stock_list)} symbols from FMP")

    # Filter out any remaining ETFs/funds/trusts
    filtered_list = []
    for item in stock_list:
        symbol = item.get("symbol", "")
        company_name = item.get("companyName", "").upper()

        # Skip if symbol or name contains ETF/fund indicators
        if any(keyword in symbol.upper() for keyword in ["ETF", "FUND"]):
            continue
        if any(keyword in company_name for keyword in ["ETF", "FUND", "TRUST", "INDEX"]):
            continue

        filtered_list.append(item)

    print(f"[UNIVERSE] Filtered to {len(filtered_list)} stocks (removed {len(stock_list) - len(filtered_list)} ETFs/funds/trusts)")
    stock_list = filtered_list

    # 2. Upsert all symbols into the database
    count = db.upsert_symbols_bulk(stock_list)

    duration = time.time() - start_time
    print(f"[UNIVERSE] Imported {count} symbols in {duration:.1f}s")

    return count


def fetch_and_set_sp500_flags() -> int:
    """
    Fetch S&P 500 constituents and mark them in the symbols table.
    Also sets tier=1 for S&P 500 symbols (frequent refresh).

    Returns: Number of S&P 500 symbols flagged
    """
    print("\n[UNIVERSE] Fetching S&P 500 constituents...")

    # Try FMP first
    sp500_list = fmp_client.get_sp500_constituents()

    if not sp500_list:
        # Fallback to sp500live.co
        print("[UNIVERSE] FMP S&P 500 list empty, trying sp500live.co...")
        try:
            resp = requests.get("https://www.sp500live.co/sp500_companies.json", timeout=15)
            data = resp.json()
            sp500_list = [{"symbol": ticker} for ticker in data.keys()]
        except Exception as e:
            print(f"[UNIVERSE] Error fetching from sp500live: {e}")
            return 0

    if not sp500_list:
        print("[UNIVERSE] No S&P 500 constituents found")
        return 0

    # Extract ticker symbols and normalize (SP500Live uses dots, FMP uses hyphens)
    sp500_tickers = []
    for item in sp500_list:
        symbol = item.get("symbol")
        if symbol:
            # Normalize: convert dots to hyphens to match FMP format in symbols table
            normalized = symbol.replace(".", "-")
            sp500_tickers.append(normalized)

    # Set flags in database
    db.set_sp500_flags(sp500_tickers)

    print(f"[UNIVERSE] Flagged {len(sp500_tickers)} S&P 500 symbols")
    return len(sp500_tickers)


def enrich_sp500_sector_industry() -> int:
    """
    Enrich S&P 500 stocks with sector/industry data from SP500Live.
    This runs after setting S&P 500 flags.

    Returns: Number of stocks enriched
    """
    print("\n[UNIVERSE] Enriching S&P 500 stocks with sector/industry...")

    try:
        # Fetch from SP500Live (includes sector/industry)
        resp = requests.get("https://www.sp500live.co/sp500_companies.json", timeout=15)
        data = resp.json()

        # Update symbols table with sector/industry
        count = 0
        for ticker, info in data.items():
            # Normalize ticker: SP500Live uses dots, FMP uses hyphens
            normalized_ticker = ticker.replace(".", "-")
            sector = info.get("sector", "").strip()
            industry = info.get("industry", "").strip()

            if sector or industry:
                db.update_symbol_sector_industry(normalized_ticker, sector, industry)
                count += 1

        print(f"[UNIVERSE] Enriched {count} S&P 500 stocks with sector/industry")
        return count
    except Exception as e:
        print(f"[ERROR] Failed to enrich S&P 500 sector/industry: {e}")
        return 0


def refresh_universe_quotes_tiered() -> Dict[str, int]:
    """
    Refresh stock quotes based on tier:
    - Tier 1 (S&P 500): Refreshed every call
    - Tier 2 (NASDAQ 100): Refreshed if called
    - Tier 3 (rest): Only during full universe refresh

    Returns: Dict with counts per tier
    """
    results = {"tier1": 0, "tier2": 0, "tier3": 0}

    # Get tier 1 symbols (S&P 500)
    tier1_symbols = db.get_symbols_by_tier(tier=1)

    if tier1_symbols:
        print(f"[UNIVERSE] Refreshing {len(tier1_symbols)} tier 1 (S&P 500) symbols...")
        quotes = fmp_client.get_batch_quotes_optimized(tier1_symbols)

        if quotes:
            # Convert quotes to stock format and upsert
            stocks = _quotes_to_stocks(quotes)
            count = db.insert_stocks_bulk(stocks)

            # Sync flags and metadata from symbols table
            db.sync_sp500_flags_to_stocks()
            db.sync_sector_industry_to_stocks()

            results["tier1"] = count
            print(f"[UNIVERSE] Updated {count} tier 1 stocks")

    return results


def refresh_full_universe_quotes() -> int:
    """
    Refresh quotes for ALL active symbols in the universe.
    Should be run once daily during off-market hours.
    Uses optimized batch quotes (200 symbols per API call).

    Returns: Number of stocks updated
    """
    print("\n[UNIVERSE] Starting full universe quote refresh...")
    start_time = time.time()

    # Get all active symbols
    all_symbols = db.get_all_active_symbols()

    if not all_symbols:
        print("[UNIVERSE] No active symbols found")
        return 0

    print(f"[UNIVERSE] Refreshing quotes for {len(all_symbols)} symbols...")

    # Fetch quotes in optimized batches
    quotes = fmp_client.get_batch_quotes_optimized(all_symbols)

    if not quotes:
        print("[UNIVERSE] No quotes returned")
        return 0

    # Convert to stock format and upsert
    stocks = _quotes_to_stocks(quotes)
    count = db.insert_stocks_bulk(stocks)

    # Sync flags and metadata from symbols table
    db.sync_sp500_flags_to_stocks()
    db.sync_sector_industry_to_stocks()

    duration = time.time() - start_time
    print(f"[UNIVERSE] Updated {count} stocks in {duration:.1f}s")

    return count


def _quotes_to_stocks(quotes: List[Dict]) -> List[Dict]:
    """Convert FMP quote format to stock table format."""
    stocks = []
    now = datetime.now().isoformat()

    for q in quotes:
        if not q.get("symbol"):
            continue

        stocks.append({
            "ticker": q.get("symbol"),
            "name": q.get("name", ""),
            "sector": None,  # Will be filled from symbols table or profile
            "industry": None,
            "price": q.get("price", 0),
            "change_1d": q.get("changesPercentage", 0),
            "change_1w": 0,
            "change_1m": 0,
            "change_1y": 0,
            "change_5y": 0,
            "change_ytd": 0,
            "volume": q.get("volume", 0),
            "high_1d": q.get("dayHigh"),
            "low_1d": q.get("dayLow"),
            "high_1m": None,
            "low_1m": None,
            "high_1y": q.get("yearHigh"),
            "low_1y": q.get("yearLow"),
            "high_5y": None,
            "low_5y": None,
            "pe_ratio": q.get("pe"),
            "eps": q.get("eps"),
            "dividend_yield": 0,
            "market_cap": q.get("marketCap"),
            "shares_outstanding": q.get("sharesOutstanding"),
            "net_profit_margin": 0,
            "gross_margin": 0,
            "roe": 0,
            "revenue_ttm": None,
            "beta": 1.0,
            "institutional_ownership": 0,
            "debt_to_equity": None,
            "year_founded": None,
            "website": None,
            "city": None,
            "state": None,
            "zip": None,
            "weight": 0,
            "last_updated": now,
            "data_source": "fmp",
            "is_sp500": False  # Will be set from symbols table
        })

    return stocks


def get_universe_stats() -> Dict:
    """Get statistics about the current universe."""
    return db.get_symbols_count()


def populate_stocks_from_symbols() -> int:
    """
    Simple function to populate stocks table from symbols.
    Bypasses tier logic - gets all symbols directly via raw SQL.

    Use this if tiered/full refresh is failing.

    Returns: Number of stocks inserted
    """
    from sqlalchemy import text

    print("\n" + "="*60)
    print("POPULATE STOCKS FROM SYMBOLS")
    print("="*60)

    print("\n[POPULATE] Getting all active symbols directly...")

    # Get symbols directly via raw SQL to bypass any tier issues
    try:
        with db.get_session() as session:
            result = session.execute(text("SELECT symbol FROM symbols WHERE is_active = TRUE ORDER BY symbol"))
            all_symbols = [row.symbol for row in result.fetchall()]
    except Exception as e:
        print(f"[POPULATE] Error getting symbols: {e}")
        return 0

    if not all_symbols:
        print("[POPULATE] No active symbols found in database!")
        return 0

    print(f"[POPULATE] Found {len(all_symbols)} active symbols")

    # Fetch quotes in batches
    print("[POPULATE] Fetching quotes from FMP (this may take a few minutes)...")
    quotes = fmp_client.get_batch_quotes_optimized(all_symbols)

    if not quotes:
        print("[POPULATE] No quotes returned from FMP!")
        return 0

    print(f"[POPULATE] Got {len(quotes)} quotes from FMP")

    # Convert to stock format and insert
    print("[POPULATE] Converting quotes to stock format...")
    stocks = _quotes_to_stocks(quotes)

    print(f"[POPULATE] Inserting {len(stocks)} stocks into database...")
    count = db.insert_stocks_bulk(stocks)

    # Sync flags and metadata from symbols table
    print("[POPULATE] Syncing is_sp500 flags...")
    db.sync_sp500_flags_to_stocks()

    print("[POPULATE] Syncing sector/industry...")
    db.sync_sector_industry_to_stocks()

    print("\n" + "="*60)
    print(f"POPULATE COMPLETE: {count} stocks inserted")
    print("="*60)

    return count


def bootstrap_sp500_stocks() -> int:
    """
    Bootstrap stocks table with S&P 500 only.
    Much faster than full universe (~500 stocks vs 24k).
    Takes ~25-30 seconds instead of 20+ minutes.

    Returns: Number of stocks loaded
    """
    print("\n[BOOTSTRAP] Starting S&P 500 bootstrap...")
    start_time = time.time()

    # Get S&P 500 symbols from symbols table
    sp500_symbols = db.get_sp500_symbols()

    if not sp500_symbols:
        # If no S&P 500 flags set, fetch and set them first
        print("[BOOTSTRAP] No S&P 500 flags found, fetching constituents...")
        fetch_and_set_sp500_flags()
        sp500_symbols = db.get_sp500_symbols()

    if not sp500_symbols:
        print("[BOOTSTRAP] Could not find S&P 500 symbols")
        return 0

    print(f"[BOOTSTRAP] Fetching quotes for {len(sp500_symbols)} S&P 500 stocks...")

    # Fetch quotes (takes ~25-30 seconds for 500 stocks)
    quotes = fmp_client.get_batch_quotes_optimized(sp500_symbols)

    if not quotes:
        print("[BOOTSTRAP] No quotes returned")
        return 0

    # Convert and insert
    stocks = _quotes_to_stocks(quotes)
    count = db.insert_stocks_bulk(stocks)

    # Sync metadata from symbols table
    db.sync_sp500_flags_to_stocks()
    db.sync_sector_industry_to_stocks()

    duration = time.time() - start_time
    print(f"[BOOTSTRAP] Loaded {count} S&P 500 stocks in {duration:.1f}s")

    return count


def fetch_and_cache_single_stock(symbol: str) -> Dict:
    """
    Fetch a single stock from FMP and cache it in the stocks table.
    Enriches with company profile (sector/industry) and key metrics (ROE, margins).
    Used for on-demand fetching when user clicks a non-cached stock.

    Args:
        symbol: Stock ticker symbol (e.g., "AAPL")

    Returns:
        Stock data dict or None if not found
    """
    print(f"[FETCH] Getting quote + profile for {symbol}...")

    quote = fmp_client.get_quote(symbol)
    if not quote:
        print(f"[FETCH] No quote found for {symbol}")
        return None

    # Convert to stock format
    stocks = _quotes_to_stocks([quote])
    if not stocks:
        return None

    stock = stocks[0]

    # Enrich with company profile (sector, industry, beta)
    try:
        profile = fmp_client.get_company_profile(symbol)
        if profile and len(profile) > 0:
            p = profile[0]
            stock["sector"] = p.get("sector") or stock.get("sector")
            stock["industry"] = p.get("industry") or stock.get("industry")
            stock["beta"] = p.get("beta") or stock.get("beta")
            stock["website"] = p.get("website")
            stock["city"] = p.get("city")
            stock["state"] = p.get("state")
    except Exception as e:
        print(f"[FETCH] Profile enrichment failed for {symbol}: {e}")

    # Enrich with key metrics (ROE, margins)
    try:
        metrics = fmp_client.get_key_metrics(symbol, period="annual", limit=1)
        if metrics and len(metrics) > 0:
            m = metrics[0]
            stock["roe"] = m.get("returnOnEquity") or stock.get("roe")
            stock["revenue_ttm"] = m.get("revenuePerShare") or stock.get("revenue_ttm")

        ratios = fmp_client.get_ratios(symbol, period="annual", limit=1)
        if ratios and len(ratios) > 0:
            r = ratios[0]
            stock["gross_margin"] = r.get("grossProfitMargin") or stock.get("gross_margin")
            stock["net_profit_margin"] = r.get("netProfitMargin") or stock.get("net_profit_margin")
            stock["pe_ratio"] = r.get("priceToEarningsRatio") or stock.get("pe_ratio")
    except Exception as e:
        print(f"[FETCH] Metrics enrichment failed for {symbol}: {e}")

    # Insert into database
    db.insert_stocks_bulk([stock])

    # Get the inserted record
    return db.get_stock(symbol)


# Convenience function for full daily refresh
def run_daily_universe_refresh() -> Dict[str, int]:
    """
    Run the full daily universe refresh:
    1. Import all symbols from FMP
    2. Set S&P 500 flags
    3. Refresh quotes for full universe

    Returns: Dict with counts
    """
    results = {
        "symbols_imported": 0,
        "sp500_flagged": 0,
        "quotes_updated": 0
    }

    print("\n" + "="*60)
    print("DAILY UNIVERSE REFRESH")
    print("="*60)

    # 1. Import full symbol list
    results["symbols_imported"] = fetch_and_import_full_universe()

    # 2. Set S&P 500 flags
    results["sp500_flagged"] = fetch_and_set_sp500_flags()

    # 2.5 Enrich S&P 500 with sector/industry
    results["sp500_enriched"] = enrich_sp500_sector_industry()

    # 3. Refresh all quotes
    results["quotes_updated"] = refresh_full_universe_quotes()

    print("\n" + "="*60)
    print(f"DAILY REFRESH COMPLETE: {results}")
    print("="*60)

    return results
