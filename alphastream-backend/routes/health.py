"""Root, health-check, market-status and data-status endpoints."""

from datetime import datetime
from fastapi import APIRouter, HTTPException

from database.db_manager import db
from services.refresh_scheduler import is_market_hours

router = APIRouter()


@router.get("/")
def root():
    try:
        return {"name": "AlphaStream API", "version": "0.1.0", "status": "running"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in root: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check():
    """Health check endpoint"""
    try:
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "database": "connected",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in health_check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/market/status")
def get_market_status():
    """Market session status derived from refresh_scheduler.is_market_hours()."""
    try:
        now = datetime.utcnow()
        open_now = is_market_hours()
        status = "Open" if open_now else "Closed"
        return {
            "status": status,
            "isMarketOpen": open_now,
            "serverTime": now.isoformat(),
        }
    except Exception as exc:
        print(f"Error in get_market_status: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/data/status")
def get_data_status():
    """Get database refresh status and data age"""
    try:
        age_minutes = db.get_data_age()
        refresh_history = db.get_refresh_history(limit=5)
        if age_minutes is None and refresh_history is None:
            raise HTTPException(status_code=503, detail="Data not available")
        return {
            "data_age_minutes": round(age_minutes, 2) if age_minutes else None,
            "last_refresh": refresh_history if refresh_history else None,
            "recent_refreshes": refresh_history,
            "total_stocks": len(db.get_all_stocks()),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_data_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/data/status/summary")
def get_data_status_summary():
    """Get database refresh status (summary)"""
    try:
        age_minutes = db.get_data_age()
        refresh_history = db.get_refresh_history(limit=5)
        if age_minutes is None and refresh_history is None:
            raise HTTPException(status_code=503, detail="Data not available")
        return {
            "data_age_minutes": round(age_minutes, 2) if age_minutes else None,
            "recent_refreshes": refresh_history,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_data_status_summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
