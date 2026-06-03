"""Background scheduler for automatic database refresh"""
import logging
import schedule
import time
import threading
from datetime import datetime, timedelta
import pytz

logger = logging.getLogger(__name__)

# Stop flag for graceful scheduler shutdown
_scheduler_stop = threading.Event()
from services.hybrid_importer import (
    refresh_all_hybrid_data,
    fetch_and_import_market_movers_from_fmp,
)
from services.macro_importer import refresh_all_macro_data, refresh_macro_history
from services.news_importer import (
    refresh_general_news,
    refresh_stock_latest,
    refresh_newsapi_categories,
    prune_old_news,
)
from config import NEWSAPI_REFRESH_MINUTES
from services.sector_importer import (
    refresh_sector_snapshot,
    backfill_sector_history,
)
from services.earnings_importer import refresh_earnings_window

# US Eastern timezone
ET = pytz.timezone('US/Eastern')


def is_market_hours() -> bool:
    """Check if current time is during US market hours (9:30 AM - 4:00 PM ET)"""
    now_et = datetime.now(ET)
    market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)

    is_weekday = now_et.weekday() < 5
    is_open = market_open <= now_et <= market_close
    return is_weekday and is_open


def refresh_job():
    """Execute database refresh - called by APScheduler"""
    try:
        print(f"\nStarting scheduled refresh at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}...")
        hybrid_counts = refresh_all_hybrid_data()
        macro_counts = refresh_all_macro_data()

        print("[OK] Refresh complete")
        print(f"   Hybrid: {hybrid_counts.get('stocks', 0)} stocks, {hybrid_counts.get('indices', 0)} indices")
        print(f"   Sectors: {hybrid_counts.get('sectors', 0)}, Movers: {hybrid_counts.get('movers', 0)}")
        print(f"   Macro: {macro_counts.get('indicators', 0)} indicators, {macro_counts.get('assets', 0)} alt assets")

    except Exception as e:
        print(f"Refresh failed: {e}")


def schedule_refresh():
    """Set up refresh schedule"""
    # During market hours: every 15 minutes
    schedule.every(15).minutes.do(lambda: refresh_job() if is_market_hours() else None)

    # Outside market hours: every hour
    schedule.every().hour.do(lambda: refresh_job() if not is_market_hours() else None)

    # News refresh (general + mixed stock feed) every 10 minutes
    schedule.every(10).minutes.do(news_job)
    schedule.every(NEWSAPI_REFRESH_MINUTES).minutes.do(newsapi_job)

    # Fast market snapshot (sectors + movers) every 5 minutes during market hours
    schedule.every(5).minutes.do(lambda: fast_market_job() if is_market_hours() else None)

    # Daily sector history backfill (early morning)
    schedule.every().day.at("04:00").do(lambda: backfill_sector_history(days=45))

    # Daily macro history refresh (treasury, CPI, VIX) to keep charts current
    schedule.every().day.at("05:00").do(refresh_macro_history)

    # Earnings refresh
    schedule.every().hour.do(lambda: earnings_job(hourly=True))
    schedule.every().day.at("04:30").do(lambda: earnings_job(hourly=False))

    # Prune old news daily
    schedule.every().day.at("03:00").do(lambda: prune_old_news(7))

    # Chat thread retention — delete expired threads daily at 03:30
    schedule.every().day.at("03:30").do(chat_retention_job)

    # Market summary (Gemini) — hourly during market hours only
    schedule.every().hour.do(market_summary_job)

    print("Refresh scheduler initialized")
    print("   - Market hours (Mon-Fri 9:30 AM - 4:00 PM ET): Every 15 minutes")
    print("   - Outside market hours: Every hour")
    print("   - News: Every 10 minutes (general + stock latest)")
    print(f"   - NewsAPI categories: Every {NEWSAPI_REFRESH_MINUTES} minutes")
    print("   - News prune: Daily at 03:00")
    print("   - Market summary (Gemini): Every hour during market hours")


def run_scheduler():
    """Run the scheduler in a loop"""
    while not _scheduler_stop.is_set():
        schedule.run_pending()
        _scheduler_stop.wait(30)


def stop_scheduler():
    """Signal the background scheduler loop to exit."""
    _scheduler_stop.set()
    logger.info("[SCHEDULER] Shutdown requested")


def start_scheduler_background():
    """Start scheduler in background thread"""
    schedule_refresh()

    # Run initial refresh in background for faster startup
    def initial_refresh():
        print("\n[SCHEDULER] Running initial database refresh in background...")
        try:
            refresh_job()
            news_job()
            newsapi_job()
            fast_market_job()
            earnings_job(hourly=False)
            refresh_macro_history()
            print("[SCHEDULER] Initial refresh completed")
        except Exception as e:
            print(f"[SCHEDULER] Initial refresh error: {e}")

    # Start initial refresh in background thread
    init_thread = threading.Thread(target=initial_refresh, daemon=True)
    init_thread.start()

    def startup_market_summary():
        try:
            from services.market_summary_generator import maybe_generate_on_startup

            maybe_generate_on_startup()
        except Exception as e:
            print(f"[SCHEDULER] Market summary startup error: {e}")

    summary_thread = threading.Thread(target=startup_market_summary, daemon=True)
    summary_thread.start()

    _scheduler_stop.clear()
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    print("[SCHEDULER] Background scheduler started\n")


def market_summary_job():
    """Hourly Gemini market summary refresh (market hours only)."""
    try:
        from services.market_summary_generator import market_summary_job as _run

        _run()
    except Exception as e:
        print(f"[MARKET_SUMMARY] Scheduled job error: {e}")


def news_job():
    """Refresh news caches."""
    try:
        general_count = refresh_general_news(limit=150)
        stock_latest_count = refresh_stock_latest(limit=200)
        print(f"[OK] News refresh: general={general_count}, stock_latest={stock_latest_count}")
    except Exception as e:
        print(f"News refresh failed: {e}")


def newsapi_job():
    """Refresh NewsAPI category caches."""
    try:
        inserted = refresh_newsapi_categories(per_category_limit=40)
        if inserted:
            print(f"[OK] NewsAPI category refresh: {inserted} articles")
    except Exception as e:
        print(f"NewsAPI refresh failed: {e}")


def fast_market_job():
    """Refresh sectors and movers from FMP stable endpoints."""
    try:
        sectors = refresh_sector_snapshot()
        movers = fetch_and_import_market_movers_from_fmp(limit=10)
        print(f"[OK] Fast market refresh: sectors={sectors}, movers={movers}")
    except Exception as e:
        print(f"Fast market refresh failed: {e}")


def earnings_job(hourly: bool = False):
    """
    Refresh earnings calendar:
      - hourly: today and tomorrow
      - daily: yesterday to +14 days
    """
    try:
        today = datetime.now().date()
        if hourly:
            start = today
            end = today + timedelta(days=1)
        else:
            start = today - timedelta(days=1)
            end = today + timedelta(days=14)
        inserted = refresh_earnings_window(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        print(f"[OK] Earnings refresh: {inserted} rows ({start} -> {end})")
    except Exception as e:
        print(f"Earnings refresh failed: {e}")


def chat_retention_job():
    """Delete chat threads that have been inactive for 14+ days."""
    try:
        from database.chat_store import delete_expired_threads

        count = delete_expired_threads()
        if count:
            print(f"[OK] Chat retention: deleted {count} expired threads")
    except Exception as e:
        print(f"Chat retention cleanup failed: {e}")

