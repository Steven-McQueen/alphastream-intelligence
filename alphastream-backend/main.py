# AlphaStream API Backend — thin entrypoint
# All route logic lives in routes/*. This file creates the app, adds
# middleware, includes routers, and handles the startup event.

import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.db_manager import db
from services.refresh_scheduler import start_scheduler_background, stop_scheduler
from services.universe_importer import bootstrap_sp500_stocks, ensure_full_symbol_directory

# ── Route modules ────────────────────────────────────────────────────────────
from routes.health import router as health_router
from routes.live import router as live_router
from routes.screener import router as screener_router
from routes.universe import router as universe_router
from routes.stock import router as stock_router
from routes.market import router as market_router
from routes.earnings import router as earnings_router
from routes.calendar import router as calendar_router
from routes.watchlist import router as watchlist_router
from routes.news import router as news_router
from routes.congress import router as congress_router
from routes.charts import router as charts_router
from routes.financials import router as financials_router
from routes.macro import router as macro_router
from routes.dcf import router as dcf_router
from routes.analyst import router as analyst_router
from routes.portfolio import router as portfolio_router
from routes.chat import router as chat_router
from routes.chat_threads import router as chat_threads_router
from routes.ai_models import router as ai_models_router
from routes.ai_config import router as ai_config_router
from routes.agents import router as agents_router
from routes.atlas import router as atlas_router

# ── App creation ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="AlphaStream API",
    description="Backend for AlphaStream Intelligence Terminal",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include routers ──────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(live_router)
app.include_router(screener_router)
app.include_router(universe_router)
app.include_router(stock_router)
app.include_router(market_router)
app.include_router(earnings_router)
app.include_router(calendar_router)
app.include_router(watchlist_router)
app.include_router(news_router)
app.include_router(congress_router)
app.include_router(charts_router)
app.include_router(financials_router)
app.include_router(macro_router)
app.include_router(dcf_router)
app.include_router(analyst_router)
app.include_router(portfolio_router)
app.include_router(chat_router)
app.include_router(chat_threads_router)
app.include_router(ai_models_router)
app.include_router(ai_config_router)
app.include_router(agents_router)
app.include_router(atlas_router)


# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup."""
    try:
        stock_count = db.count_stocks()
        if stock_count < 100:
            print("[STARTUP] Stocks table is empty or has few records, bootstrapping S&P 500...")

            def bootstrap_thread():
                try:
                    count = bootstrap_sp500_stocks()
                    print(f"[STARTUP] Bootstrap complete: {count} stocks loaded")
                except Exception as e:
                    print(f"[STARTUP] Bootstrap failed: {e}")

            thread = threading.Thread(target=bootstrap_thread, daemon=True)
            thread.start()
        else:
            print(f"[STARTUP] Stocks table has {stock_count} records, skipping bootstrap")
    except Exception as e:
        print(f"[STARTUP] Error checking stocks table: {e}")

    try:
        def universe_thread():
            try:
                ensure_full_symbol_directory()
            except Exception as e:
                print(f"[STARTUP] Universe directory import failed: {e}")

        thread = threading.Thread(target=universe_thread, daemon=True)
        thread.start()
    except Exception as e:
        print(f"[STARTUP] Error starting universe import: {e}")

    try:
        from database.ai_model_store import bootstrap_if_empty
        from services.chat.provider_registry import invalidate_cache

        if bootstrap_if_empty():
            print("[STARTUP] Seeded default AI provider/model catalog")
        invalidate_cache()
    except Exception as e:
        print(f"[STARTUP] AI model catalog bootstrap skipped: {e}")

    start_scheduler_background()


@app.on_event("shutdown")
async def shutdown_event():
    """Stop background scheduler on app shutdown."""
    stop_scheduler()


# ── Direct run ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
