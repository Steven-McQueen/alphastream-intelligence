"""Congressional trades endpoints (/api/congress/*)."""

from fastapi import APIRouter, HTTPException

from services.fmp_client import fmp_client

router = APIRouter(prefix="/api/congress")


@router.get("/trades/recent")
def get_recent_congress_trades(limit: int = 50):
    """Get recent congressional trades aggregated from both Senate and House."""
    try:
        print(f"[DATA] Fetching recent congress trades, limit={limit}")

        senators = ["tuberville", "pelosi", "cruz", "scott", "warren", "rubio", "burr", "capito"]
        representatives = ["comer", "pelosi", "johnson", "jeffries", "scalise", "ocasio-cortez"]

        all_trades = []

        for senator in senators:
            try:
                trades = fmp_client.get_senate_trades_by_name(senator)
                if trades:
                    all_trades.extend(trades[:10])
            except Exception as e:
                print(f"Error fetching trades for senator {senator}: {e}")
                continue

        for rep in representatives:
            try:
                trades = fmp_client.get_house_trades_by_name(rep)
                if trades:
                    all_trades.extend(trades[:10])
            except Exception as e:
                print(f"Error fetching trades for rep {rep}: {e}")
                continue

        all_trades.sort(key=lambda x: x.get("disclosureDate", ""), reverse=True)
        return all_trades[:limit]
    except Exception as exc:
        print(f"Error in get_recent_congress_trades: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/trades/{symbol}")
def get_congress_trades_for_stock(symbol: str, limit: int = 100):
    """Get all congressional trades for a specific stock symbol."""
    try:
        ticker = symbol.upper()
        print(f"[DATA] Fetching congress trades for {ticker}")

        all_trades = []

        try:
            senate_trades = fmp_client.get_senate_trades_by_symbol(ticker)
            if senate_trades:
                all_trades.extend(senate_trades)
        except Exception as e:
            print(f"Error fetching senate trades for {ticker}: {e}")

        try:
            house_trades = fmp_client.get_house_trades_by_symbol(ticker)
            if house_trades:
                all_trades.extend(house_trades)
        except Exception as e:
            print(f"Error fetching house trades for {ticker}: {e}")

        all_trades.sort(key=lambda x: x.get("disclosureDate", ""), reverse=True)
        return all_trades[:limit]
    except Exception as exc:
        print(f"Error in get_congress_trades_for_stock: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
