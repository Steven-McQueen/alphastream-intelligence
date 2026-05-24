"""Portfolio endpoint (mock data — kept per user request)."""

from fastapi import APIRouter, HTTPException

from models import Portfolio

router = APIRouter()


def _get_mock_portfolio() -> dict:
    """Inline mock portfolio data."""
    return {
        "id": "default",
        "name": "My Portfolio",
        "holdings": [],
        "totalValue": 0.0,
        "totalCost": 0.0,
        "cash": 0.0,
        "ytdReturn": 0.0,
        "dailyPnL": 0.0,
        "dailyPnLPercent": 0.0,
        "totalUnrealizedPnL": 0.0,
        "volatility": 0.0,
        "sharpeRatio": 0.0,
        "beta": 0.0,
        "lastUpdated": "2026-01-01T00:00:00",
    }


@router.get("/api/portfolio", response_model=Portfolio)
def portfolio():
    try:
        result = _get_mock_portfolio()
        if not result:
            raise HTTPException(status_code=503, detail="Data not available")
        return result
    except Exception as exc:
        print(f"Error in portfolio: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
