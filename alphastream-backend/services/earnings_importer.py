"""
Earnings importer using FMP stable earnings-calendar endpoint.
"""

from datetime import datetime
from typing import List, Optional

from database.db_manager import db
from services.fmp_client import fmp_client


def refresh_earnings_window(from_date: str, to_date: str, tickers: Optional[List[str]] = None) -> int:
    """
    Fetch earnings calendar for date range and upsert to DB.
    tickers (optional): if provided, filter to those symbols after fetch.
    """
    try:
        data = fmp_client.get_earnings_calendar_range(from_date, to_date)
        if not data:
            print(f"[ERROR] No earnings data for window {from_date} -> {to_date}")
            return 0

        inserted = 0
        for row in data:
            symbol = row.get("symbol")
            if not symbol:
                continue
            if tickers and symbol not in tickers:
                continue
            db.insert_or_update_earning(
                ticker=symbol,
                company_name=row.get("company", "") or row.get("name", ""),
                report_date=row.get("date"),
                fiscal_period="",
                eps_estimate=row.get("epsEstimated"),
                eps_actual=row.get("epsActual"),
                revenue_estimate=row.get("revenueEstimated"),
                revenue_actual=row.get("revenueActual"),
                time="",
            )
            inserted += 1
        print(f"[OK] Earnings upserted: {inserted} rows for {from_date} -> {to_date}")
        return inserted
    except Exception as exc:
        print(f"[ERROR] Earnings refresh failed: {exc}")
        return 0

