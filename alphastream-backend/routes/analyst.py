"""Analyst ratings and estimates endpoints (/api/stock/{ticker}/analyst/*)."""

from fastapi import APIRouter, HTTPException

from services.fmp_client import fmp_client

router = APIRouter(prefix="/api/stock")


@router.get("/{ticker}/analyst/ratings")
def get_analyst_ratings(ticker: str):
    """Get comprehensive analyst ratings data for a stock."""
    try:
        symbol = ticker.upper()

        ratings_historical = []
        grades_consensus = []
        price_target = []
        price_target_summary = []
        recent_grades = []

        try:
            ratings_historical = fmp_client.get_ratings_historical(symbol, limit=100) or []
        except Exception as e:
            print(f"[WARN] Could not fetch ratings historical for {symbol}: {e}")

        try:
            grades_consensus = fmp_client.get_grades_consensus(symbol) or []
        except Exception as e:
            print(f"[WARN] Could not fetch grades consensus for {symbol}: {e}")

        try:
            price_target = fmp_client.get_price_target_consensus(symbol) or []
        except Exception as e:
            print(f"[WARN] Could not fetch price target consensus for {symbol}: {e}")

        try:
            price_target_summary = fmp_client.get_price_target_summary(symbol) or []
        except Exception as e:
            print(f"[WARN] Could not fetch price target summary for {symbol}: {e}")

        try:
            recent_grades = fmp_client.get_analyst_grades(symbol, limit=20) or []
        except Exception as e:
            print(f"[WARN] Could not fetch analyst grades for {symbol}: {e}")

        consensus_rating = "Hold"
        consensus_score = 0

        if grades_consensus and len(grades_consensus) > 0:
            gc = grades_consensus[0]
            buy_count = (gc.get("buy", 0) or 0) + (gc.get("strongBuy", 0) or 0)
            sell_count = (gc.get("sell", 0) or 0) + (gc.get("strongSell", 0) or 0)
            hold_count = gc.get("hold", 0) or 0
            total = buy_count + sell_count + hold_count

            if total > 0:
                weighted = (
                    (gc.get("strongBuy", 0) or 0) * 5 +
                    (gc.get("buy", 0) or 0) * 4 +
                    (gc.get("hold", 0) or 0) * 3 +
                    (gc.get("sell", 0) or 0) * 2 +
                    (gc.get("strongSell", 0) or 0) * 1
                )
                consensus_score = round(weighted / total, 2)

                if consensus_score >= 4.5:
                    consensus_rating = "Strong Buy"
                elif consensus_score >= 3.5:
                    consensus_rating = "Buy"
                elif consensus_score >= 2.5:
                    consensus_rating = "Hold"
                elif consensus_score >= 1.5:
                    consensus_rating = "Sell"
                else:
                    consensus_rating = "Strong Sell"

        return {
            "symbol": symbol,
            "consensusRating": consensus_rating,
            "consensusScore": consensus_score,
            "ratingsHistorical": ratings_historical[:30],
            "gradesConsensus": grades_consensus[0] if grades_consensus else {},
            "priceTarget": price_target[0] if price_target else {},
            "priceTargetSummary": price_target_summary[0] if price_target_summary else {},
            "recentGrades": recent_grades[:15],
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching analyst ratings for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/analyst/estimates")
def get_analyst_estimates(ticker: str, period: str = "annual", limit: int = 5):
    """Get analyst estimates for EPS, revenue, etc."""
    try:
        symbol = ticker.upper()
        data = fmp_client.get_analyst_estimates(symbol, period=period, limit=limit)
        if not data:
            return []
        return data
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching analyst estimates for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/analyst/price-targets")
def get_analyst_price_targets(ticker: str):
    """Get analyst price target information."""
    try:
        symbol = ticker.upper()

        consensus = []
        summary = []

        try:
            consensus = fmp_client.get_price_target_consensus(symbol) or []
        except Exception as e:
            print(f"[WARN] Could not fetch price target consensus for {symbol}: {e}")

        try:
            summary = fmp_client.get_price_target_summary(symbol) or []
        except Exception as e:
            print(f"[WARN] Could not fetch price target summary for {symbol}: {e}")

        return {
            "symbol": symbol,
            "consensus": consensus[0] if consensus else {},
            "summary": summary[0] if summary else {},
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching price targets for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/analyst/grades")
def get_analyst_grades(ticker: str, limit: int = 30):
    """Get individual analyst grades (upgrades/downgrades history)."""
    try:
        symbol = ticker.upper()
        data = fmp_client.get_analyst_grades(symbol, limit=limit)
        if not data:
            return []
        return data
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching analyst grades for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
