"""
PostgreSQL Database Manager for AlphaStream Intelligence
Uses SQLAlchemy with psycopg2 for Supabase PostgreSQL connection.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os


class PostgresDatabaseManager:
    """Manages PostgreSQL database connection for stock data caching"""

    def __init__(self, database_url: str = None):
        """
        Initialize the database manager with connection pooling.

        Args:
            database_url: PostgreSQL connection string. If None, reads from DATABASE_URL env var.
        """
        self.database_url = database_url or os.getenv("DATABASE_URL", "")

        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")

        # Create engine with connection pooling
        self.engine = create_engine(
            self.database_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=1800,  # Recycle connections after 30 minutes
            echo=False  # Set to True for SQL debugging
        )

        # Create session factory
        self.SessionLocal = sessionmaker(bind=self.engine)

    def init_database(self):
        """
        No-op for PostgreSQL - tables are created via Supabase SQL Editor.
        This method exists for compatibility with SQLite manager.
        """
        print("PostgreSQL tables should be created via Supabase SQL Editor.")
        print("See database/schema_postgres.sql for the schema.")

    def close(self):
        """
        No-op for PostgreSQL - connection pooling handles this automatically.
        This method exists for compatibility with SQLite manager.
        """
        pass

    @contextmanager
    def get_session(self):
        """Context manager for database sessions with automatic cleanup."""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _row_to_dict(self, row) -> dict:
        """Convert a SQLAlchemy row to dictionary."""
        if row is None:
            return None
        return dict(row._mapping)

    def _rows_to_dicts(self, rows) -> List[dict]:
        """Convert SQLAlchemy rows to list of dictionaries."""
        return [dict(row._mapping) for row in rows]

    # ============================================================================
    # STOCKS METHODS
    # ============================================================================

    def insert_stocks_bulk(self, stocks: List[dict]) -> int:
        """
        Insert or update multiple stocks using PostgreSQL ON CONFLICT.
        Optimized for bulk operations with batched writes.
        """
        if not stocks:
            return 0

        with self.get_session() as session:
            success_count = 0

            # Process in batches of 100 for better performance
            batch_size = 100
            for i in range(0, len(stocks), batch_size):
                batch = stocks[i:i + batch_size]

                for stock in batch:
                    try:
                        session.execute(text("""
                            INSERT INTO stocks (
                                ticker, name, sector, industry,
                                price, change_1d, change_1w, change_1m, change_1y, change_5y, change_ytd,
                                volume,
                                high_1d, low_1d, high_1m, low_1m, high_1y, low_1y, high_5y, low_5y,
                                pe_ratio, eps, dividend_yield, market_cap, shares_outstanding,
                                net_profit_margin, gross_margin, roe, revenue_ttm,
                                beta, institutional_ownership, debt_to_equity,
                                year_founded, website, city, state, zip, weight,
                                last_updated, data_source, is_sp500
                            ) VALUES (
                                :ticker, :name, :sector, :industry,
                                :price, :change_1d, :change_1w, :change_1m, :change_1y, :change_5y, :change_ytd,
                                :volume,
                                :high_1d, :low_1d, :high_1m, :low_1m, :high_1y, :low_1y, :high_5y, :low_5y,
                                :pe_ratio, :eps, :dividend_yield, :market_cap, :shares_outstanding,
                                :net_profit_margin, :gross_margin, :roe, :revenue_ttm,
                                :beta, :institutional_ownership, :debt_to_equity,
                                :year_founded, :website, :city, :state, :zip, :weight,
                                :last_updated, :data_source, :is_sp500
                            )
                            ON CONFLICT (ticker) DO UPDATE SET
                                name = EXCLUDED.name,
                                sector = EXCLUDED.sector,
                                industry = EXCLUDED.industry,
                                price = EXCLUDED.price,
                                change_1d = EXCLUDED.change_1d,
                                change_1w = EXCLUDED.change_1w,
                                change_1m = EXCLUDED.change_1m,
                                change_1y = EXCLUDED.change_1y,
                                change_5y = EXCLUDED.change_5y,
                                change_ytd = EXCLUDED.change_ytd,
                                volume = EXCLUDED.volume,
                                high_1d = EXCLUDED.high_1d,
                                low_1d = EXCLUDED.low_1d,
                                high_1m = EXCLUDED.high_1m,
                                low_1m = EXCLUDED.low_1m,
                                high_1y = EXCLUDED.high_1y,
                                low_1y = EXCLUDED.low_1y,
                                high_5y = EXCLUDED.high_5y,
                                low_5y = EXCLUDED.low_5y,
                                pe_ratio = EXCLUDED.pe_ratio,
                                eps = EXCLUDED.eps,
                                dividend_yield = EXCLUDED.dividend_yield,
                                market_cap = EXCLUDED.market_cap,
                                shares_outstanding = EXCLUDED.shares_outstanding,
                                net_profit_margin = EXCLUDED.net_profit_margin,
                                gross_margin = EXCLUDED.gross_margin,
                                roe = EXCLUDED.roe,
                                revenue_ttm = EXCLUDED.revenue_ttm,
                                beta = EXCLUDED.beta,
                                institutional_ownership = EXCLUDED.institutional_ownership,
                                debt_to_equity = EXCLUDED.debt_to_equity,
                                year_founded = EXCLUDED.year_founded,
                                website = EXCLUDED.website,
                                city = EXCLUDED.city,
                                state = EXCLUDED.state,
                                zip = EXCLUDED.zip,
                                weight = EXCLUDED.weight,
                                last_updated = EXCLUDED.last_updated,
                                data_source = EXCLUDED.data_source,
                                is_sp500 = EXCLUDED.is_sp500
                        """), stock)
                        success_count += 1
                    except Exception as e:
                        print(f"Error inserting {stock.get('ticker')}: {e}")

                # Commit each batch
                session.commit()

            print(f"Inserted/updated {success_count}/{len(stocks)} stocks")
            return success_count

    def get_stock(self, ticker: str) -> Optional[dict]:
        """Get a single stock by ticker."""
        with self.get_session() as session:
            result = session.execute(
                text("SELECT * FROM stocks WHERE ticker = :ticker"),
                {"ticker": ticker}
            )
            row = result.fetchone()
            return self._row_to_dict(row)

    def get_all_stocks(self, order_by: str = "market_cap DESC NULLS LAST") -> List[dict]:
        """Get all stocks with optional ordering."""
        allowed_columns = {"market_cap", "ticker", "name", "change_1d", "volume", "sector"}
        allowed_directions = {"asc", "desc"}

        parts = order_by.split()
        col = parts[0].lower() if parts else ""
        direction = parts[1].lower() if len(parts) > 1 else "desc"

        if col not in allowed_columns:
            col = "market_cap"
            direction = "desc"
        if direction not in allowed_directions:
            direction = "desc"

        safe_order = f"{col} {direction.upper()} NULLS LAST"

        with self.get_session() as session:
            result = session.execute(text(f"SELECT * FROM stocks ORDER BY {safe_order}"))
            return self._rows_to_dicts(result.fetchall())

    def search_stocks(self, query: str) -> List[dict]:
        """Search stocks by ticker or name."""
        with self.get_session() as session:
            search_term = f"%{query.upper()}%"
            result = session.execute(
                text("""
                    SELECT * FROM stocks
                    WHERE ticker ILIKE :search OR UPPER(name) LIKE :search
                    ORDER BY market_cap DESC NULLS LAST
                    LIMIT 50
                """),
                {"search": search_term}
            )
            return self._rows_to_dicts(result.fetchall())

    def get_stocks_by_sector(self, sector: str) -> List[dict]:
        """Get all stocks in a sector."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT * FROM stocks
                    WHERE sector = :sector
                    ORDER BY market_cap DESC NULLS LAST
                """),
                {"sector": sector}
            )
            return self._rows_to_dicts(result.fetchall())

    def upsert_stocks_from_screener(self, updates: List[dict]) -> int:
        """
        Update stocks table with data from screener results.
        Only updates price, market_cap, beta, dividend_yield, volume, and last_updated.
        Used for cross-view caching - when user filters screener, we cache the fresh data.
        """
        if not updates:
            return 0

        with self.get_session() as session:
            success_count = 0
            now = datetime.utcnow().isoformat()

            for item in updates:
                try:
                    session.execute(text("""
                        INSERT INTO stocks (
                            ticker, name, sector, industry,
                            price, market_cap, beta, dividend_yield, volume,
                            last_updated
                        ) VALUES (
                            :ticker, :name, :sector, :industry,
                            :price, :market_cap, :beta, :dividend_yield, :volume,
                            :last_updated
                        )
                        ON CONFLICT (ticker) DO UPDATE SET
                            price = COALESCE(EXCLUDED.price, stocks.price),
                            market_cap = COALESCE(EXCLUDED.market_cap, stocks.market_cap),
                            beta = COALESCE(EXCLUDED.beta, stocks.beta),
                            dividend_yield = COALESCE(EXCLUDED.dividend_yield, stocks.dividend_yield),
                            volume = COALESCE(EXCLUDED.volume, stocks.volume),
                            last_updated = EXCLUDED.last_updated
                    """), {
                        "ticker": item.get("ticker"),
                        "name": item.get("name"),
                        "sector": item.get("sector"),
                        "industry": item.get("industry"),
                        "price": item.get("price"),
                        "market_cap": item.get("market_cap"),
                        "beta": item.get("beta"),
                        "dividend_yield": item.get("dividend_yield"),
                        "volume": item.get("volume"),
                        "last_updated": now,
                    })
                    success_count += 1
                except Exception as e:
                    print(f"[DB] Error upserting stock {item.get('ticker')}: {e}")

            return success_count

    # ============================================================================
    # COMPANY PROFILE CACHE METHODS
    # ============================================================================

    def get_cached_profile(self, symbol: str) -> Optional[dict]:
        """
        Get cached company profile if it exists and is not expired (24h TTL).
        Returns None if not cached or expired.
        """
        with self.get_session() as session:
            result = session.execute(text("""
                SELECT data, last_updated
                FROM company_profiles
                WHERE symbol = :symbol
                AND last_updated > NOW() - INTERVAL '24 hours'
            """), {"symbol": symbol.upper()})
            row = result.fetchone()
            if row:
                return row._mapping["data"]
            return None

    def set_cached_profile(self, symbol: str, data: dict) -> None:
        """
        Cache company profile data with 24-hour TTL.
        """
        import json
        with self.get_session() as session:
            session.execute(text("""
                INSERT INTO company_profiles (symbol, data, last_updated)
                VALUES (:symbol, :data::jsonb, NOW())
                ON CONFLICT (symbol) DO UPDATE SET
                    data = EXCLUDED.data,
                    last_updated = NOW()
            """), {
                "symbol": symbol.upper(),
                "data": json.dumps(data),
            })

    def get_stock_with_age(self, ticker: str) -> tuple:
        """
        Get stock with age in seconds since last update.
        Returns (stock_dict, age_seconds) or (None, None) if not found.
        """
        with self.get_session() as session:
            result = session.execute(text("""
                SELECT *,
                       EXTRACT(EPOCH FROM (NOW() - last_updated)) as age_seconds
                FROM stocks
                WHERE ticker = :ticker
            """), {"ticker": ticker.upper()})
            row = result.fetchone()
            if row:
                row_dict = self._row_to_dict(row)
                age = row_dict.pop("age_seconds", None)
                return row_dict, age
            return None, None

    def increment_stock_view_count(self, ticker: str) -> None:
        """
        Increment view count for a stock (for popularity tracking).
        """
        with self.get_session() as session:
            session.execute(text("""
                UPDATE stocks
                SET view_count = COALESCE(view_count, 0) + 1,
                    last_viewed_at = NOW()
                WHERE ticker = :ticker
            """), {"ticker": ticker.upper()})

    def get_popular_stocks(self, limit: int = 100) -> List[dict]:
        """
        Get most viewed stocks for pre-fetching.
        """
        with self.get_session() as session:
            result = session.execute(text("""
                SELECT ticker, name, sector, view_count
                FROM stocks
                WHERE view_count > 0
                ORDER BY view_count DESC NULLS LAST
                LIMIT :limit
            """), {"limit": limit})
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # REFRESH LOG METHODS
    # ============================================================================

    def log_refresh(self, stocks_updated: int, data_source: str,
                    success: bool, duration: float, error_msg: Optional[str] = None):
        """Log a data refresh event."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO refresh_log
                    (stocks_updated, data_source, success, error_message, duration_seconds)
                    VALUES (:stocks_updated, :data_source, :success, :error_message, :duration)
                """),
                {
                    "stocks_updated": stocks_updated,
                    "data_source": data_source,
                    "success": success,
                    "error_message": error_msg,
                    "duration": duration
                }
            )

    def get_data_age(self) -> Optional[float]:
        """Get age of cached data in minutes."""
        with self.get_session() as session:
            result = session.execute(text("""
                SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 60 as age_minutes
                FROM stocks
            """))
            row = result.fetchone()
            return row.age_minutes if row and row.age_minutes else None

    def needs_refresh(self, max_age_minutes: int = 15) -> bool:
        """Check if data needs refresh."""
        age = self.get_data_age()
        if age is None:
            return True
        return age > max_age_minutes

    def get_refresh_history(self, limit: int = 5) -> List[dict]:
        """Return recent refresh log entries."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT refresh_time, stocks_updated, data_source, success, error_message, duration_seconds
                    FROM refresh_log
                    ORDER BY refresh_time DESC
                    LIMIT :limit
                """),
                {"limit": limit}
            )
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # MARKET INDICES METHODS
    # ============================================================================

    def insert_or_update_index(self, symbol: str, name: str, value: float,
                               change: float, change_pct: float):
        """Insert or update a market index."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO market_indices (symbol, name, value, change, change_pct, last_updated)
                    VALUES (:symbol, :name, :value, :change, :change_pct, NOW())
                    ON CONFLICT (symbol) DO UPDATE SET
                        name = EXCLUDED.name,
                        value = EXCLUDED.value,
                        change = EXCLUDED.change,
                        change_pct = EXCLUDED.change_pct,
                        last_updated = NOW()
                """),
                {
                    "symbol": symbol,
                    "name": name,
                    "value": value,
                    "change": change,
                    "change_pct": change_pct
                }
            )

    def get_all_indices(self) -> List[dict]:
        """Get all market indices."""
        with self.get_session() as session:
            result = session.execute(text("SELECT * FROM market_indices"))
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # SECTOR PERFORMANCE METHODS
    # ============================================================================

    def insert_or_update_sector_performance(self, sector: str, change_percent: float):
        """Insert or update sector performance snapshot."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO sector_performance (sector, change_percent, last_updated)
                    VALUES (:sector, :change_percent, NOW())
                    ON CONFLICT (sector) DO UPDATE SET
                        change_percent = EXCLUDED.change_percent,
                        last_updated = NOW()
                """),
                {"sector": sector, "change_percent": change_percent}
            )

    def get_sector_performance(self) -> List[dict]:
        """Return cached sector performance records."""
        with self.get_session() as session:
            result = session.execute(
                text("SELECT * FROM sector_performance ORDER BY change_percent DESC")
            )
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # MARKET MOVERS METHODS
    # ============================================================================

    def clear_market_movers(self):
        """Remove existing market mover rows."""
        with self.get_session() as session:
            session.execute(text("DELETE FROM market_movers"))

    def insert_market_mover(self, ticker: str, name: str, price: float,
                            change: float, change_percent: float, volume: int,
                            category: str, market_cap: float = None):
        """Insert a single market mover row."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO market_movers
                    (ticker, name, price, change, change_percent, volume, category, market_cap, last_updated)
                    VALUES (:ticker, :name, :price, :change, :change_percent, :volume, :category, :market_cap, NOW())
                """),
                {
                    "ticker": ticker,
                    "name": name,
                    "price": price,
                    "change": change,
                    "change_percent": change_percent,
                    "volume": volume,
                    "category": category,
                    "market_cap": market_cap
                }
            )

    def get_market_movers(self, category: str = None) -> List[dict]:
        """Retrieve movers, optionally filtered by category."""
        with self.get_session() as session:
            if category:
                result = session.execute(
                    text("""
                        SELECT * FROM market_movers
                        WHERE category = :category
                        ORDER BY change_percent DESC
                    """),
                    {"category": category}
                )
            else:
                result = session.execute(
                    text("SELECT * FROM market_movers ORDER BY change_percent DESC")
                )
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # EARNINGS CALENDAR METHODS
    # ============================================================================

    def insert_or_update_earning(self, ticker: str, company_name: str,
                                  report_date: str, fiscal_period: str,
                                  eps_estimate: float = None, eps_actual: float = None,
                                  revenue_estimate: float = None, revenue_actual: float = None,
                                  time: str = None):
        """Insert or update an earnings calendar entry."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO earnings_calendar
                    (ticker, company_name, report_date, fiscal_period, eps_estimate, eps_actual,
                     revenue_estimate, revenue_actual, time, last_updated)
                    VALUES (:ticker, :company_name, :report_date, :fiscal_period, :eps_estimate,
                            :eps_actual, :revenue_estimate, :revenue_actual, :time, NOW())
                    ON CONFLICT (ticker, report_date, fiscal_period) DO UPDATE SET
                        company_name = EXCLUDED.company_name,
                        eps_estimate = EXCLUDED.eps_estimate,
                        eps_actual = EXCLUDED.eps_actual,
                        revenue_estimate = EXCLUDED.revenue_estimate,
                        revenue_actual = EXCLUDED.revenue_actual,
                        time = EXCLUDED.time,
                        last_updated = NOW()
                """),
                {
                    "ticker": ticker,
                    "company_name": company_name,
                    "report_date": report_date,
                    "fiscal_period": fiscal_period,
                    "eps_estimate": eps_estimate,
                    "eps_actual": eps_actual,
                    "revenue_estimate": revenue_estimate,
                    "revenue_actual": revenue_actual,
                    "time": time
                }
            )

    def get_earnings_calendar(self, from_date: str = None, to_date: str = None) -> List[dict]:
        """Retrieve earnings calendar entries."""
        with self.get_session() as session:
            if from_date and to_date:
                result = session.execute(
                    text("""
                        SELECT * FROM earnings_calendar
                        WHERE report_date BETWEEN :from_date AND :to_date
                        ORDER BY report_date ASC
                    """),
                    {"from_date": from_date, "to_date": to_date}
                )
            else:
                result = session.execute(
                    text("SELECT * FROM earnings_calendar ORDER BY report_date ASC")
                )
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # NEWS ARTICLES METHODS
    # ============================================================================

    def upsert_news_articles_bulk(self, articles: List[dict]) -> int:
        """Upsert multiple news articles keyed by URL."""
        if not articles:
            return 0

        with self.get_session() as session:
            inserted = 0
            for item in articles:
                try:
                    session.execute(
                        text("""
                            INSERT INTO news_articles
                            (ticker, title, url, published_date, snippet, site, publisher, image, last_cached)
                            VALUES (:ticker, :title, :url, :published_date, :snippet, :site, :publisher, :image, NOW())
                            ON CONFLICT (url) DO UPDATE SET
                                ticker = EXCLUDED.ticker,
                                title = EXCLUDED.title,
                                published_date = EXCLUDED.published_date,
                                snippet = EXCLUDED.snippet,
                                site = EXCLUDED.site,
                                publisher = EXCLUDED.publisher,
                                image = EXCLUDED.image,
                                last_cached = NOW()
                        """),
                        {
                            "ticker": item.get("ticker"),
                            "title": item.get("title"),
                            "url": item.get("url"),
                            "published_date": item.get("published_date"),
                            "snippet": item.get("snippet"),
                            "site": item.get("site"),
                            "publisher": item.get("publisher"),
                            "image": item.get("image")
                        }
                    )
                    inserted += 1
                except Exception as e:
                    print(f"Error inserting news article: {e}")
            return inserted

    def get_news_general(self, limit: int = 50) -> List[dict]:
        """Get recent general market news."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT * FROM news_articles
                    WHERE ticker IS NULL
                    ORDER BY published_date DESC NULLS LAST
                    LIMIT :limit
                """),
                {"limit": limit}
            )
            return self._rows_to_dicts(result.fetchall())

    def get_news_for_ticker(self, ticker: str, limit: int = 50) -> List[dict]:
        """Get news for a specific ticker."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT * FROM news_articles
                    WHERE ticker = :ticker
                    ORDER BY published_date DESC NULLS LAST
                    LIMIT :limit
                """),
                {"ticker": ticker.upper(), "limit": limit}
            )
            return self._rows_to_dicts(result.fetchall())

    def prune_news(self, max_age_days: int = 7) -> int:
        """Delete news articles older than max_age_days."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    DELETE FROM news_articles
                    WHERE last_cached < NOW() - INTERVAL '1 day' * :days
                """),
                {"days": int(max_age_days)}
            )
            return result.rowcount

    # ============================================================================
    # SECTOR PERFORMANCE HISTORY METHODS
    # ============================================================================

    def upsert_sector_history_bulk(self, rows: List[dict]) -> int:
        """Insert or replace sector performance history rows."""
        if not rows:
            return 0

        with self.get_session() as session:
            inserted = 0
            for row in rows:
                try:
                    session.execute(
                        text("""
                            INSERT INTO sector_performance_history
                            (date, sector, exchange, average_change, last_cached)
                            VALUES (:date, :sector, :exchange, :average_change, NOW())
                            ON CONFLICT (date, sector) DO UPDATE SET
                                exchange = EXCLUDED.exchange,
                                average_change = EXCLUDED.average_change,
                                last_cached = NOW()
                        """),
                        {
                            "date": row.get("date"),
                            "sector": row.get("sector"),
                            "exchange": row.get("exchange"),
                            "average_change": row.get("average_change")
                        }
                    )
                    inserted += 1
                except Exception as e:
                    print(f"Error inserting sector history: {e}")
            return inserted

    def get_latest_sector_history_date(self) -> Optional[str]:
        """Return latest date stored in sector_performance_history."""
        with self.get_session() as session:
            result = session.execute(
                text("SELECT MAX(date) as latest_date FROM sector_performance_history")
            )
            row = result.fetchone()
            return str(row.latest_date) if row and row.latest_date else None

    def get_sector_history(self, start_date: str = None, end_date: str = None) -> List[dict]:
        """Fetch sector history rows between dates."""
        with self.get_session() as session:
            if start_date and end_date:
                result = session.execute(
                    text("""
                        SELECT date, sector, exchange, average_change
                        FROM sector_performance_history
                        WHERE date BETWEEN :start_date AND :end_date
                        ORDER BY date DESC
                    """),
                    {"start_date": start_date, "end_date": end_date}
                )
            elif start_date:
                result = session.execute(
                    text("""
                        SELECT date, sector, exchange, average_change
                        FROM sector_performance_history
                        WHERE date >= :start_date
                        ORDER BY date DESC
                    """),
                    {"start_date": start_date}
                )
            else:
                result = session.execute(
                    text("""
                        SELECT date, sector, exchange, average_change
                        FROM sector_performance_history
                        ORDER BY date DESC
                    """)
                )
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # PRICE BARS METHODS
    # ============================================================================

    def upsert_price_bars_bulk(self, bars: List[dict]) -> int:
        """Insert or replace multiple price bars."""
        if not bars:
            return 0

        with self.get_session() as session:
            inserted = 0

            # Process in batches
            batch_size = 500
            for i in range(0, len(bars), batch_size):
                batch = bars[i:i + batch_size]

                for bar in batch:
                    try:
                        session.execute(
                            text("""
                                INSERT INTO price_bars
                                (symbol, timeframe, bar_time, open, high, low, close, volume, source, last_updated)
                                VALUES (:symbol, :timeframe, :bar_time, :open, :high, :low, :close, :volume, :source, NOW())
                                ON CONFLICT (symbol, timeframe, bar_time) DO UPDATE SET
                                    open = EXCLUDED.open,
                                    high = EXCLUDED.high,
                                    low = EXCLUDED.low,
                                    close = EXCLUDED.close,
                                    volume = EXCLUDED.volume,
                                    source = EXCLUDED.source,
                                    last_updated = NOW()
                            """),
                            {
                                "symbol": bar.get("symbol"),
                                "timeframe": bar.get("timeframe"),
                                "bar_time": bar.get("bar_time"),
                                "open": bar.get("open"),
                                "high": bar.get("high"),
                                "low": bar.get("low"),
                                "close": bar.get("close"),
                                "volume": bar.get("volume"),
                                "source": bar.get("source")
                            }
                        )
                        inserted += 1
                    except Exception as e:
                        print(f"Error inserting price bar: {e}")

                session.commit()

            return inserted

    def get_price_bars(self, symbol: str, timeframe: str, limit: int = 1500,
                       start_time: str = None, end_time: str = None) -> List[dict]:
        """Retrieve price bars for a symbol/timeframe ordered newest -> oldest."""
        with self.get_session() as session:
            query = """
                SELECT symbol, timeframe, bar_time, open, high, low, close, volume, source
                FROM price_bars
                WHERE symbol = :symbol AND timeframe = :timeframe
            """
            params = {"symbol": symbol, "timeframe": timeframe, "limit": limit}

            if start_time:
                query += " AND bar_time >= :start_time"
                params["start_time"] = start_time
            if end_time:
                query += " AND bar_time <= :end_time"
                params["end_time"] = end_time

            query += " ORDER BY bar_time DESC LIMIT :limit"

            result = session.execute(text(query), params)
            return self._rows_to_dicts(result.fetchall())

    def get_eod_last_updated(self, symbol: str) -> Optional[str]:
        """Get the last_updated timestamp for EOD data of a symbol."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT last_updated FROM price_bars
                    WHERE symbol = :symbol AND timeframe = '1day'
                    ORDER BY last_updated DESC LIMIT 1
                """),
                {"symbol": symbol}
            )
            row = result.fetchone()
            return str(row.last_updated) if row else None

    def delete_eod_bars(self, symbol: str) -> int:
        """Delete all EOD bars for a symbol."""
        with self.get_session() as session:
            result = session.execute(
                text("DELETE FROM price_bars WHERE symbol = :symbol AND timeframe = '1day'"),
                {"symbol": symbol}
            )
            return result.rowcount

    def get_intraday_last_updated(self, symbol: str, timeframe: str = "5min") -> Optional[str]:
        """Get the last_updated timestamp for intraday data."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT last_updated FROM price_bars
                    WHERE symbol = :symbol AND timeframe = :timeframe
                    ORDER BY last_updated DESC LIMIT 1
                """),
                {"symbol": symbol, "timeframe": timeframe}
            )
            row = result.fetchone()
            return str(row.last_updated) if row else None

    def delete_intraday_bars(self, symbol: str, timeframe: str = "5min") -> int:
        """Delete all intraday bars for a symbol/timeframe."""
        with self.get_session() as session:
            result = session.execute(
                text("DELETE FROM price_bars WHERE symbol = :symbol AND timeframe = :timeframe"),
                {"symbol": symbol, "timeframe": timeframe}
            )
            return result.rowcount

    # ============================================================================
    # ALTERNATIVE ASSETS METHODS
    # ============================================================================

    def insert_or_update_alternative_asset(self, symbol: str, name: str, asset_type: str,
                                            value: float = None, change: float = None,
                                            change_percent: float = None, fetch_error: str = None):
        """Insert or update an alternative asset."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO alternative_assets
                    (symbol, name, asset_type, value, change, change_percent, last_updated, fetch_error)
                    VALUES (:symbol, :name, :asset_type, :value, :change, :change_percent, NOW(), :fetch_error)
                    ON CONFLICT (symbol) DO UPDATE SET
                        name = EXCLUDED.name,
                        asset_type = EXCLUDED.asset_type,
                        value = EXCLUDED.value,
                        change = EXCLUDED.change,
                        change_percent = EXCLUDED.change_percent,
                        last_updated = NOW(),
                        fetch_error = EXCLUDED.fetch_error
                """),
                {
                    "symbol": symbol,
                    "name": name,
                    "asset_type": asset_type,
                    "value": value,
                    "change": change,
                    "change_percent": change_percent,
                    "fetch_error": fetch_error
                }
            )

    def get_all_alternative_assets(self) -> List[dict]:
        """Return all alternative assets."""
        with self.get_session() as session:
            result = session.execute(text("SELECT * FROM alternative_assets"))
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # MACRO INDICATORS METHODS
    # ============================================================================

    def insert_or_update_indicator(self, indicator_id: str, name: str,
                                   value: float, change: float = None, unit: str = '%'):
        """Insert or update a macro indicator."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO macro_indicators (indicator_id, name, value, change, unit, last_updated)
                    VALUES (:indicator_id, :name, :value, :change, :unit, NOW())
                    ON CONFLICT (indicator_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        value = EXCLUDED.value,
                        change = EXCLUDED.change,
                        unit = EXCLUDED.unit,
                        last_updated = NOW()
                """),
                {
                    "indicator_id": indicator_id,
                    "name": name,
                    "value": value,
                    "change": change,
                    "unit": unit
                }
            )

    def get_all_indicators(self) -> List[dict]:
        """Get all macro indicators."""
        with self.get_session() as session:
            result = session.execute(text("SELECT * FROM macro_indicators"))
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # HISTORICAL DATA METHODS
    # ============================================================================

    def insert_treasury_history(self, date: str, yield_10y: float, yield_2y: float = None):
        """Insert treasury yield data."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO treasury_history (date, yield_10y, yield_2y, last_updated)
                    VALUES (:date, :yield_10y, :yield_2y, NOW())
                    ON CONFLICT (date) DO UPDATE SET
                        yield_10y = EXCLUDED.yield_10y,
                        yield_2y = EXCLUDED.yield_2y,
                        last_updated = NOW()
                """),
                {"date": date, "yield_10y": yield_10y, "yield_2y": yield_2y}
            )

    def get_treasury_history(self, days: int = 365) -> List[dict]:
        """Get treasury yield history."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT date, yield_10y, yield_2y FROM treasury_history
                    WHERE date >= CURRENT_DATE - INTERVAL ':days days'
                    ORDER BY date ASC
                """.replace(":days", str(days)))
            )
            return self._rows_to_dicts(result.fetchall())

    def insert_cpi_history(self, date: str, cpi_value: float,
                           mom_change: float = None, yoy_change: float = None):
        """Insert CPI historical data."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO cpi_history (date, cpi_value, mom_change, yoy_change, last_updated)
                    VALUES (:date, :cpi_value, :mom_change, :yoy_change, NOW())
                    ON CONFLICT (date) DO UPDATE SET
                        cpi_value = EXCLUDED.cpi_value,
                        mom_change = EXCLUDED.mom_change,
                        yoy_change = EXCLUDED.yoy_change,
                        last_updated = NOW()
                """),
                {
                    "date": date,
                    "cpi_value": cpi_value,
                    "mom_change": mom_change,
                    "yoy_change": yoy_change
                }
            )

    def get_cpi_history(self, months: int = 12) -> List[dict]:
        """Get CPI history."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT date, cpi_value, mom_change, yoy_change FROM cpi_history
                    ORDER BY date DESC
                    LIMIT :months
                """),
                {"months": months}
            )
            rows = self._rows_to_dicts(result.fetchall())
            return list(reversed(rows))

    def insert_vix_history(self, date: str, vix_close: float,
                           vix_high: float = None, vix_low: float = None):
        """Insert VIX historical data."""
        with self.get_session() as session:
            session.execute(
                text("""
                    INSERT INTO vix_history (date, vix_close, vix_high, vix_low, last_updated)
                    VALUES (:date, :vix_close, :vix_high, :vix_low, NOW())
                    ON CONFLICT (date) DO UPDATE SET
                        vix_close = EXCLUDED.vix_close,
                        vix_high = EXCLUDED.vix_high,
                        vix_low = EXCLUDED.vix_low,
                        last_updated = NOW()
                """),
                {
                    "date": date,
                    "vix_close": vix_close,
                    "vix_high": vix_high,
                    "vix_low": vix_low
                }
            )

    def get_vix_history(self, days: int = 365) -> List[dict]:
        """Get VIX history."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT date, vix_close, vix_high, vix_low FROM vix_history
                    WHERE date >= CURRENT_DATE - INTERVAL ':days days'
                    ORDER BY date ASC
                """.replace(":days", str(days)))
            )
            return self._rows_to_dicts(result.fetchall())

    # ============================================================================
    # SYMBOLS TABLE METHODS (Master Universe)
    # ============================================================================

    def upsert_symbols_bulk(self, symbols: List[dict]) -> int:
        """
        Bulk upsert symbols into the master universe table.
        Expects list of dicts with keys: symbol, name, exchange, asset_type, etc.
        """
        if not symbols:
            return 0

        with self.get_session() as session:
            success_count = 0
            batch_size = 500

            for i in range(0, len(symbols), batch_size):
                batch = symbols[i:i + batch_size]

                for item in batch:
                    try:
                        session.execute(
                            text("""
                                INSERT INTO symbols (symbol, name, exchange, asset_type, sector, industry, is_active)
                                VALUES (:symbol, :name, :exchange, :asset_type, :sector, :industry, TRUE)
                                ON CONFLICT (symbol) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    exchange = EXCLUDED.exchange,
                                    asset_type = EXCLUDED.asset_type,
                                    sector = COALESCE(EXCLUDED.sector, symbols.sector),
                                    industry = COALESCE(EXCLUDED.industry, symbols.industry),
                                    is_active = TRUE,
                                    updated_at = NOW()
                            """),
                            {
                                "symbol": item.get("symbol"),
                                "name": item.get("name", item.get("companyName", "")),  # actively-trading-list returns "name" directly
                                "exchange": item.get("exchange", item.get("exchangeShortName")),
                                "asset_type": "stock",  # Force to stock since we're filtering ETFs/funds
                                "sector": item.get("sector"),  # Will be NULL initially, enriched later
                                "industry": item.get("industry")  # Will be NULL initially, enriched later
                            }
                        )
                        success_count += 1
                    except Exception as e:
                        print(f"Error upserting symbol {item.get('symbol')}: {e}")

                session.commit()

            print(f"Upserted {success_count}/{len(symbols)} symbols")
            return success_count

    def get_symbols_by_tier(self, tier: int) -> List[str]:
        """Get list of symbols for a specific refresh tier."""
        print(f"[DEBUG] get_symbols_by_tier called with tier={tier} (type={type(tier)})")
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT symbol FROM symbols
                    WHERE tier = :tier AND is_active = TRUE
                    ORDER BY symbol
                """),
                {"tier": int(tier)}  # Explicit cast to int
            )
            symbols = [row.symbol for row in result.fetchall()]
            print(f"[DEBUG] get_symbols_by_tier returned {len(symbols)} symbols")
            return symbols

    def get_all_active_symbols(self) -> List[str]:
        """Get all active symbols for full universe refresh."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT symbol FROM symbols
                    WHERE is_active = TRUE
                    ORDER BY symbol
                """)
            )
            return [row.symbol for row in result.fetchall()]

    def get_symbols_count(self) -> dict:
        """Get count of symbols by category."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_active = TRUE) as active,
                        COUNT(*) FILTER (WHERE is_sp500 = TRUE) as sp500,
                        COUNT(*) FILTER (WHERE is_nasdaq100 = TRUE) as nasdaq100,
                        COUNT(*) FILTER (WHERE tier = 1) as tier1,
                        COUNT(*) FILTER (WHERE tier = 2) as tier2,
                        COUNT(*) FILTER (WHERE tier = 3) as tier3
                    FROM symbols
                """)
            )
            row = result.fetchone()
            return {
                "total": row.total,
                "active": row.active,
                "sp500": row.sp500,
                "nasdaq100": row.nasdaq100,
                "tier1": row.tier1,
                "tier2": row.tier2,
                "tier3": row.tier3
            }

    def set_sp500_flags(self, sp500_tickers: List[str]):
        """Mark symbols as S&P 500 members and set tier 1."""
        with self.get_session() as session:
            # Reset all sp500 flags first
            session.execute(text("UPDATE symbols SET is_sp500 = FALSE WHERE is_sp500 = TRUE"))

            # Set sp500 flag and tier 1 for provided tickers
            if sp500_tickers:
                # Use IN clause with bindparam for better compatibility with hyphenated symbols
                from sqlalchemy import bindparam
                session.execute(
                    text("""
                        UPDATE symbols
                        SET is_sp500 = TRUE, tier = 1
                        WHERE symbol IN :tickers
                    """).bindparams(bindparam("tickers", expanding=True)),
                    {"tickers": sp500_tickers}
                )

            session.commit()
            print(f"Set S&P 500 flags for {len(sp500_tickers)} symbols")

    def set_nasdaq100_flags(self, nasdaq100_tickers: List[str]):
        """Mark symbols as NASDAQ 100 members."""
        with self.get_session() as session:
            # Reset all nasdaq100 flags first
            session.execute(text("UPDATE symbols SET is_nasdaq100 = FALSE WHERE is_nasdaq100 = TRUE"))

            # Set nasdaq100 flag for provided tickers
            if nasdaq100_tickers:
                session.execute(
                    text("""
                        UPDATE symbols
                        SET is_nasdaq100 = TRUE, tier = LEAST(tier, 2)
                        WHERE symbol = ANY(:tickers)
                    """),
                    {"tickers": nasdaq100_tickers}
                )

            session.commit()
            print(f"Set NASDAQ 100 flags for {len(nasdaq100_tickers)} symbols")

    def sync_sp500_flags_to_stocks(self):
        """Sync is_sp500 flags from symbols table to stocks table."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    UPDATE stocks
                    SET is_sp500 = sym.is_sp500
                    FROM symbols sym
                    WHERE stocks.ticker = sym.symbol
                      AND (stocks.is_sp500 IS NULL OR stocks.is_sp500 != sym.is_sp500)
                """)
            )
            updated = result.rowcount
            session.commit()
            print(f"[SYNC] Updated is_sp500 flags for {updated} stocks")
            return updated

    def update_symbol_sector_industry(self, symbol: str, sector: str, industry: str):
        """Update sector and industry for a specific symbol."""
        with self.get_session() as session:
            session.execute(
                text("""
                    UPDATE symbols
                    SET sector = :sector, industry = :industry
                    WHERE symbol = :symbol
                """),
                {"symbol": symbol, "sector": sector, "industry": industry}
            )
            session.commit()

    def sync_sector_industry_to_stocks(self):
        """Sync sector and industry from symbols table to stocks table."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    UPDATE stocks s
                    SET
                        sector = COALESCE(s.sector, sym.sector),
                        industry = COALESCE(s.industry, sym.industry)
                    FROM symbols sym
                    WHERE s.ticker = sym.symbol
                      AND (s.sector IS NULL OR s.industry IS NULL)
                      AND (sym.sector IS NOT NULL OR sym.industry IS NOT NULL)
                """)
            )
            updated = result.rowcount
            session.commit()
            print(f"[SYNC] Updated sector/industry for {updated} stocks")
            return updated

    def get_sp500_symbols(self) -> List[str]:
        """Get list of S&P 500 symbols from the symbols table."""
        with self.get_session() as session:
            result = session.execute(
                text("""
                    SELECT symbol FROM symbols
                    WHERE is_sp500 = TRUE AND is_active = TRUE
                    ORDER BY symbol
                """)
            )
            return [row.symbol for row in result.fetchall()]

    def search_symbols(self, query: str, limit: int = 20) -> List[dict]:
        """
        Search symbols table by ticker or name.
        Works even when stocks table is empty - searches the 24k+ symbols universe.

        Returns basic symbol info (ticker, name, sector, industry, is_sp500, exchange).
        """
        with self.get_session() as session:
            search_term = f"%{query.upper()}%"
            result = session.execute(
                text("""
                    SELECT
                        symbol as ticker,
                        name,
                        sector,
                        industry,
                        is_sp500,
                        exchange
                    FROM symbols
                    WHERE is_active = TRUE
                      AND (symbol ILIKE :search OR UPPER(name) LIKE :search)
                    ORDER BY
                        CASE WHEN is_sp500 = TRUE THEN 0 ELSE 1 END,
                        symbol
                    LIMIT :limit
                """),
                {"search": search_term, "limit": limit}
            )
            return self._rows_to_dicts(result.fetchall())
