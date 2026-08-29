"""Congressional trades endpoints (/api/congress/*)."""

from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException

from services.fmp_client import fmp_client
from services.response_cache import ttl_cache

router = APIRouter(prefix="/api/congress")


@router.get("/trades/recent")
@ttl_cache(seconds=300)
def get_recent_congress_trades(limit: int = 50):
    """Get recent congressional trades aggregated from both Senate and House."""
    try:
        print(f"[DATA] Fetching recent congress trades, limit={limit}")

        senators = ["tuberville", "pelosi", "cruz", "scott", "warren", "rubio", "burr", "capito"]
        representatives = ["comer", "pelosi", "johnson", "jeffries", "scalise", "ocasio-cortez"]

        def _fetch(job):
            kind, name = job
            try:
                if kind == "senate":
                    return fmp_client.get_senate_trades_by_name(name) or []
                return fmp_client.get_house_trades_by_name(name) or []
            except Exception as e:
                print(f"Error fetching trades for {kind} {name}: {e}")
                return []

        jobs = [("senate", s) for s in senators] + [("house", r) for r in representatives]
        # 14 independent FMP calls; fetch concurrently instead of sequentially.
        with ThreadPoolExecutor(max_workers=8) as pool:
            per_person = list(pool.map(_fetch, jobs))

        all_trades = []
        for trades in per_person:
            all_trades.extend(trades[:10])

        all_trades.sort(key=lambda x: x.get("disclosureDate", ""), reverse=True)
        return all_trades[:limit]
    except Exception as exc:
        print(f"Error in get_recent_congress_trades: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/trades/{symbol}")
@ttl_cache(seconds=300)
def get_congress_trades_for_stock(symbol: str, limit: int = 100):
    """Get all congressional trades for a specific stock symbol."""
    try:
        ticker = symbol.upper()
        print(f"[DATA] Fetching congress trades for {ticker}")

        def _senate():
            try:
                return fmp_client.get_senate_trades_by_symbol(ticker) or []
            except Exception as e:
                print(f"Error fetching senate trades for {ticker}: {e}")
                return []

        def _house():
            try:
                return fmp_client.get_house_trades_by_symbol(ticker) or []
            except Exception as e:
                print(f"Error fetching house trades for {ticker}: {e}")
                return []

        with ThreadPoolExecutor(max_workers=2) as pool:
            senate_future = pool.submit(_senate)
            house_future = pool.submit(_house)
            all_trades = senate_future.result() + house_future.result()

        all_trades.sort(key=lambda x: x.get("disclosureDate", ""), reverse=True)
        return all_trades[:limit]
    except Exception as exc:
        print(f"Error in get_congress_trades_for_stock: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
