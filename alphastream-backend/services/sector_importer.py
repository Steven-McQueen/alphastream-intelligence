"""
Sector performance importer and aggregation.
Uses FMP stable/sector-performance-snapshot with explicit date parameter.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from database.db_manager import db
from services.fmp_client import fmp_client


def _today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _compound_percent(changes: List[float]) -> float:
    """
    Compound a list of percentage changes (e.g., [1.0, -0.5]) into a single percent.
    """
    total = 1.0
    for c in changes:
        total *= (1.0 + c / 100.0)
    return (total - 1.0) * 100.0


def refresh_sector_snapshot(date: Optional[str] = None, exchange: Optional[str] = None) -> int:
    """Fetch sector snapshot for a date (YYYY-MM-DD) and store in history."""
    snap_date = date or _today_str()
    try:
        rows = fmp_client.get_sector_performance_snapshot(date=snap_date, exchange=exchange)
        if not rows:
            print(f"[WARN] No sector snapshot for {snap_date}")
            return 0
        to_store = []
        for r in rows:
            if r.get("sector") is None or r.get("averageChange") is None:
                continue
            change_val = float(r.get("averageChange"))
            sector_name = r.get("sector")
            to_store.append(
                {
                    "date": snap_date,
                    "sector": sector_name,
                    "exchange": r.get("exchange"),
                    "average_change": change_val,
                }
            )
            # Update latest snapshot table for quick access to 1D
            db.insert_or_update_sector_performance(sector=sector_name, change_percent=change_val)
        inserted = db.upsert_sector_history_bulk(to_store)
        print(f"[OK] Stored {inserted} sector rows for {snap_date}")
        return inserted
    except Exception as exc:
        print(f"[ERROR] Sector snapshot failed for {snap_date}: {exc}")
        return 0


def backfill_sector_history(days: int = 45, exchange: Optional[str] = None) -> int:
    """Backfill sector snapshots for the past N days (calendar days)."""
    inserted_total = 0
    today = datetime.now().date()
    for i in range(days):
        d = today - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        inserted_total += refresh_sector_snapshot(date=date_str, exchange=exchange)
    return inserted_total


def get_sector_performance_aggregated(window_days: int = 1) -> List[Dict]:
    """
    Return aggregated sector performance over the last N days (compounded).
    window_days: 1, 7, 30 supported by caller.
    """
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=window_days - 1)
    history = db.get_sector_history(start_date=start_date.strftime("%Y-%m-%d"), end_date=end_date.strftime("%Y-%m-%d"))

    # Group by sector
    by_sector: Dict[str, List[float]] = {}
    for row in history:
        sector = row.get("sector")
        change = row.get("average_change")
        if sector is None or change is None:
            continue
        by_sector.setdefault(sector, []).append(float(change))

    results = []
    for sector, changes in by_sector.items():
        compounded = _compound_percent(changes)
        results.append({"sector": sector, "change": compounded})
    return results


def get_sector_performance_summary() -> List[Dict]:
    """
    Build {sector, change1D, change1W, change1M} from stored history.
    """
    latest_date = db.get_latest_sector_history_date()
    if not latest_date:
        return []

    # Ensure today snapshot exists; if not, try to fetch
    if latest_date != _today_str():
        refresh_sector_snapshot(date=_today_str())

    agg_1d = get_sector_performance_aggregated(window_days=1)
    agg_1w = get_sector_performance_aggregated(window_days=7)
    agg_1m = get_sector_performance_aggregated(window_days=30)

    # Merge by sector
    summary: Dict[str, Dict] = {}

    for row in agg_1d:
        summary[row["sector"]] = {"sector": row["sector"], "change1D": row["change"], "change1W": 0.0, "change1M": 0.0}
    for row in agg_1w:
        summary.setdefault(row["sector"], {"sector": row["sector"], "change1D": 0.0, "change1W": 0.0, "change1M": 0.0})
        summary[row["sector"]]["change1W"] = row["change"]
    for row in agg_1m:
        summary.setdefault(row["sector"], {"sector": row["sector"], "change1D": 0.0, "change1W": 0.0, "change1M": 0.0})
        summary[row["sector"]]["change1M"] = row["change"]

    return list(summary.values())

