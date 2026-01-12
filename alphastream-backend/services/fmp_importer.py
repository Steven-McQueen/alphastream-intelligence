"""
FMP Data Importer - Fetches data from FMP and stores in the database.
"""

import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from database.db_manager import db
from services.fmp_client import fmp_client


BATCH_SIZE = 40


def _to_float(value: Optional[float], default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clean_change_percent(value: Optional[str | float]) -> float:
    if value is None:
        return 0.0
    if isinstance(value, str):
        return _to_float(value.replace("%", "").replace("+", ""))
    return _to_float(value)


def _build_stock_payload(quote: Dict, constituent: Optional[Dict]) -> Dict:
    """Map FMP quote + constituent data into our stocks schema."""
    sector = constituent.get("sector", "") if constituent else ""
    subsector = constituent.get("subSector", "") if constituent else ""
    founded = constituent.get("founded") if constituent else None

    return {
        # Identifiers
        "ticker": quote.get("symbol", "").upper(),
        "name": quote.get("name", "") or quote.get("symbol", ""),
        "sector": sector,
        "industry": subsector,
        # Price & performance
        "price": _to_float(quote.get("price")),
        "change_1d": _clean_change_percent(quote.get("changesPercentage")),
        "change_1w": 0.0,
        "change_1m": 0.0,
        "change_1y": 0.0,
        "change_5y": 0.0,
        "change_ytd": 0.0,
        # Volume
        "volume": int(_to_float(quote.get("volume"), 0)),
        # High/Low
        "high_1d": _to_float(quote.get("dayHigh")),
        "low_1d": _to_float(quote.get("dayLow")),
        "high_1m": None,
        "low_1m": None,
        "high_1y": _to_float(quote.get("yearHigh")),
        "low_1y": _to_float(quote.get("yearLow")),
        "high_5y": None,
        "low_5y": None,
        # Valuation
        "pe_ratio": _to_float(quote.get("pe"), None),
        "eps": _to_float(quote.get("eps"), None),
        "dividend_yield": 0.0,
        "market_cap": _to_float(quote.get("marketCap")),
        "shares_outstanding": _to_float(quote.get("sharesOutstanding"), None),
        # Profitability / balance sheet placeholders
        "net_profit_margin": 0.0,
        "gross_margin": 0.0,
        "roe": 0.0,
        "revenue_ttm": None,
        "beta": None,
        "institutional_ownership": None,
        "debt_to_equity": None,
        # Company info
        "year_founded": int(founded) if founded else None,
        "website": None,
        "city": None,
        "state": None,
        "zip": None,
        "weight": 0.0,
        # Metadata
        "last_updated": datetime.now().isoformat(),
        "data_source": "fmp",
        "is_sp500": 1,
    }


def fetch_and_import_sp500_from_fmp() -> int:
    """
    Fetch S&P 500 stocks from FMP and update database.
    """
    print("\n" + "=" * 60)
    print("FETCHING S&P 500 FROM FMP")
    print("=" * 60)

    start_time = time.time()
    success_count = 0

    try:
        print("Fetching S&P 500 constituent list...")
        constituents = fmp_client.get_sp500_constituents()
        if not constituents:
            print("No constituents returned from FMP.")
            return 0

        print(f"Found {len(constituents)} constituents")
        symbol_list = [c["symbol"] for c in constituents]
        constituents_map = {c["symbol"]: c for c in constituents}

        all_quotes: List[Dict] = []
        total_batches = (len(symbol_list) - 1) // BATCH_SIZE + 1

        for idx in range(0, len(symbol_list), BATCH_SIZE):
            batch = symbol_list[idx : idx + BATCH_SIZE]
            print(
                f"Fetching batch {idx // BATCH_SIZE + 1}/{total_batches} ({len(batch)} symbols)...",
                end=" ",
            )
            try:
                quotes = fmp_client.get_batch_quotes(batch)
                all_quotes.extend(quotes)
                print(f"ok ({len(quotes)} quotes)")
            except Exception as exc:
                print(f"failed: {exc}")
            time.sleep(0.2)  # stay under rate limits

        print(f"Total quotes fetched: {len(all_quotes)}")

        stocks_to_insert = []
        for quote in all_quotes:
            symbol = quote.get("symbol")
            if not symbol:
                continue
            payload = _build_stock_payload(quote, constituents_map.get(symbol))
            stocks_to_insert.append(payload)

        if stocks_to_insert:
            success_count = db.insert_stocks_bulk(stocks_to_insert)

        duration = time.time() - start_time
        print("=" * 60)
        print("S&P 500 import complete")
        print(f"   Stocks updated: {success_count}/{len(constituents)}")
        print(f"   Duration: {duration:.2f}s")
        print("=" * 60)

        db.log_refresh(
            stocks_updated=success_count,
            data_source="fmp",
            success=True,
            duration=duration,
        )
        return success_count
    except Exception as exc:
        duration = time.time() - start_time
        print(f"Import failed: {exc}")
        db.log_refresh(
            stocks_updated=0,
            data_source="fmp",
            success=False,
            duration=duration,
            error_msg=str(exc),
        )
        return 0


def fetch_and_import_indices_from_fmp() -> int:
    """Fetch market indices from FMP and update database."""
    print("\nFetching market indices from FMP...")
    try:
        quotes = fmp_client.get_index_quotes()
        if not quotes:
            print("No index data received")
            return 0

        symbol_map = {
            "^GSPC": "SPX",
            "^IXIC": "NDX",
            "^DJI": "DJI",
            "^RUT": "RUT",
            "^VIX": "VIX",
        }

        count = 0
        for quote in quotes:
            fmp_symbol = quote.get("symbol")
            if not fmp_symbol:
                continue
            target_symbol = symbol_map.get(fmp_symbol, fmp_symbol)
            db.insert_or_update_index(
                symbol=target_symbol,
                name=quote.get("name", target_symbol),
                value=_to_float(quote.get("price")),
                change=_to_float(quote.get("change")),
                change_pct=_clean_change_percent(quote.get("changesPercentage")),
            )
            count += 1
            print(
                f"  {target_symbol}: {quote.get('price')} "
                f"({_clean_change_percent(quote.get('changesPercentage')):+.2f}%)"
            )
        return count
    except Exception as exc:
        print(f"Failed to fetch indices: {exc}")
        return 0


def fetch_and_import_sector_performance() -> int:
    """Fetch sector performance from FMP and store in database."""
    print("\nFetching sector performance...")
    try:
        sectors = fmp_client.get_sector_performance()
        if not sectors:
            print("No sector data received")
            return 0

        count = 0
        for sector in sectors:
            change_val = _clean_change_percent(sector.get("changesPercentage"))
            db.insert_or_update_sector_performance(
                sector=sector.get("sector", "Unknown"), change_percent=change_val
            )
            count += 1
            print(f"  {sector.get('sector')}: {change_val:+.2f}%")
        return count
    except Exception as exc:
        print(f"Failed to fetch sectors: {exc}")
        return 0


def fetch_and_import_market_movers() -> int:
    """Fetch top gainers/losers/actives from FMP and cache in DB."""
    print("\nFetching market movers...")
    total = 0
    try:
        db.clear_market_movers()

        gainers = fmp_client.get_gainers()[:10]
        for stock in gainers:
            db.insert_market_mover(
                ticker=stock.get("symbol"),
                name=stock.get("name"),
                price=_to_float(stock.get("price")),
                change=_to_float(stock.get("change")),
                change_percent=_clean_change_percent(stock.get("changesPercentage")),
                volume=int(_to_float(stock.get("volume"), 0)),
                category="gainer",
                market_cap=_to_float(stock.get("marketCap"), None),
            )
        total += len(gainers)
        print(f"  Gainers: {len(gainers)}")

        losers = fmp_client.get_losers()[:10]
        for stock in losers:
            db.insert_market_mover(
                ticker=stock.get("symbol"),
                name=stock.get("name"),
                price=_to_float(stock.get("price")),
                change=_to_float(stock.get("change")),
                change_percent=_clean_change_percent(stock.get("changesPercentage")),
                volume=int(_to_float(stock.get("volume"), 0)),
                category="loser",
                market_cap=_to_float(stock.get("marketCap"), None),
            )
        total += len(losers)
        print(f"  Losers: {len(losers)}")

        actives = fmp_client.get_actives()[:10]
        for stock in actives:
            db.insert_market_mover(
                ticker=stock.get("symbol"),
                name=stock.get("name"),
                price=_to_float(stock.get("price")),
                change=_to_float(stock.get("change")),
                change_percent=_clean_change_percent(stock.get("changesPercentage")),
                volume=int(_to_float(stock.get("volume"), 0)),
                category="active",
                market_cap=_to_float(stock.get("marketCap"), None),
            )
        total += len(actives)
        print(f"  Actives: {len(actives)}")

        return total
    except Exception as exc:
        print(f"Failed to fetch market movers: {exc}")
        return 0


def fetch_and_import_earnings_calendar() -> int:
    """Fetch earnings calendar for the recent window and store in DB."""
    print("\nFetching earnings calendar...")
    try:
        from_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        to_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        earnings = fmp_client.get_earnings_calendar(from_date=from_date, to_date=to_date)
        if not earnings:
            print("No earnings data received")
            return 0

        count = 0
        for earning in earnings:
            db.insert_or_update_earning(
                ticker=earning.get("symbol"),
                company_name=earning.get("name", ""),
                report_date=earning.get("date"),
                fiscal_period=earning.get("fiscalDateEnding", ""),
                eps_estimate=earning.get("epsEstimated"),
                eps_actual=earning.get("eps"),
                revenue_estimate=earning.get("revenueEstimated"),
                revenue_actual=earning.get("revenue"),
                time=earning.get("time", ""),
            )
            count += 1
        print(f"  Earnings entries: {count}")
        return count
    except Exception as exc:
        print(f"Failed to fetch earnings: {exc}")
        return 0


def refresh_all_fmp_data() -> Dict[str, int]:
    """Refresh all FMP-backed datasets."""
    print("\n" + "=" * 60)
    print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - FMP DATA REFRESH")
    print("=" * 60)

    stocks_count = fetch_and_import_sp500_from_fmp()
    indices_count = fetch_and_import_indices_from_fmp()
    sectors_count = fetch_and_import_sector_performance()
    movers_count = fetch_and_import_market_movers()

    print("=" * 60)
    print("REFRESH COMPLETE")
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

