import sqlite3
import threading
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta


class DatabaseManager:
  """Manages SQLite database for stock data caching"""

  def __init__(self, db_path: str = "data/stocks.db"):
      self.db_path = db_path
      Path(db_path).parent.mkdir(parents=True, exist_ok=True)
      self._local = threading.local()  # ADD THIS LINE
  
  def connect(self):
      """Get thread-local connection"""
      # REPLACE OLD connect() METHOD WITH THIS:
      if not hasattr(self._local, 'connection') or self._local.connection is None:
          self._local.connection = sqlite3.connect(
              self.db_path,
              check_same_thread=False,
              timeout=30.0
          )
          self._local.connection.row_factory = sqlite3.Row
      return self._local.connection
  
  def close(self):
      """Close thread-local connection"""
      # REPLACE OLD close() METHOD WITH THIS:
      if hasattr(self._local, 'connection') and self._local.connection:
          self._local.connection.close()
          self._local.connection = None

  def init_database(self):
    """Initialize database with schema"""
    schema_path = Path(__file__).parent / "schema.sql"

    with open(schema_path, 'r', encoding='utf-8') as f:
      schema = f.read()

    conn = self.connect()
    conn.executescript(schema)
    conn.commit()
    print(f"Database initialized at {self.db_path}")
    self.close()

  def insert_stocks_bulk(self, stocks: List[dict]) -> int:
    """Insert multiple stocks efficiently"""
    conn = self.connect()
    cursor = conn.cursor()
    success_count = 0

    try:
      for stock in stocks:
        try:
          cursor.execute("""
            INSERT OR REPLACE INTO stocks (
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
          """, stock)
          success_count += 1
        except Exception as e:
          print(f"Error inserting {stock.get('ticker')}: {e}")

      conn.commit()
      print(f"Inserted/updated {success_count}/{len(stocks)} stocks")
      return success_count

    finally:
      self.close()

  def get_stock(self, ticker: str) -> Optional[dict]:
    """Get a single stock by ticker"""
    conn = self.connect()
    cursor = conn.cursor()

    try:
      cursor.execute("SELECT * FROM stocks WHERE ticker = ?", (ticker,))
      row = cursor.fetchone()
      return dict(row) if row else None
    finally:
      self.close()

  def get_all_stocks(self, order_by: str = "market_cap DESC") -> List[dict]:
    """Get all stocks"""
    conn = self.connect()
    cursor = conn.cursor()

    try:
      cursor.execute(f"SELECT * FROM stocks ORDER BY {order_by}")
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  def search_stocks(self, query: str) -> List[dict]:
    """Search stocks by ticker or name"""
    conn = self.connect()
    cursor = conn.cursor()

    try:
      search_term = f"%{query.upper()}%"
      cursor.execute("""
        SELECT * FROM stocks 
        WHERE ticker LIKE ? OR UPPER(name) LIKE ?
        ORDER BY market_cap DESC
        LIMIT 50
      """, (search_term, search_term))

      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  def get_stocks_by_sector(self, sector: str) -> List[dict]:
    """Get all stocks in a sector"""
    conn = self.connect()
    cursor = conn.cursor()

    try:
      cursor.execute("""
        SELECT * FROM stocks 
        WHERE sector = ?
        ORDER BY market_cap DESC
      """, (sector,))

      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  def log_refresh(self, stocks_updated: int, data_source: str,
                  success: bool, duration: float, error_msg: Optional[str] = None):
    """Log a data refresh event"""
    conn = self.connect()
    cursor = conn.cursor()

    try:
      cursor.execute("""
        INSERT INTO refresh_log (
          stocks_updated, data_source, success, error_message, duration_seconds
        ) VALUES (?, ?, ?, ?, ?)
      """, (stocks_updated, data_source, success, error_msg, duration))

      conn.commit()
    finally:
      self.close()

  def get_data_age(self) -> Optional[float]:
    """Get age of cached data in minutes"""
    conn = self.connect()
    cursor = conn.cursor()

    try:
      cursor.execute("""
        SELECT 
          (julianday('now') - julianday(MAX(last_updated))) * 24 * 60 as age_minutes
        FROM stocks
      """)
      result = cursor.fetchone()
      return result['age_minutes'] if result else None
    finally:
      self.close()

  def needs_refresh(self, max_age_minutes: int = 15) -> bool:
    """Check if data needs refresh"""
    age = self.get_data_age()
    if age is None:
      return True
    return age > max_age_minutes

  def get_refresh_history(self, limit: int = 5):
    """Return recent refresh log entries"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute("""
        SELECT refresh_time, stocks_updated, data_source, success, error_message, duration_seconds
        FROM refresh_log
        ORDER BY refresh_time DESC
        LIMIT ?
      """, (limit,))
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  # ============================================================================
  # MARKET INDICES METHODS
  # ============================================================================
  def insert_or_update_index(self, symbol: str, name: str, value: float,
                             change: float, change_pct: float):
    """Insert or update a market index"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('''
        INSERT OR REPLACE INTO market_indices 
        (symbol, name, value, change, change_pct, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
      ''', (symbol, name, value, change, change_pct, datetime.now().isoformat()))
      conn.commit()
    finally:
      self.close()

  def get_all_indices(self) -> List[dict]:
    """Get all market indices"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('SELECT * FROM market_indices')
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  # ============================================================================
  # SECTOR PERFORMANCE
  # ============================================================================
  def insert_or_update_sector_performance(self, sector: str, change_percent: float):
    """Insert or update sector performance snapshot."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        """
        INSERT OR REPLACE INTO sector_performance
        (sector, change_percent, last_updated)
        VALUES (?, ?, ?)
        """,
        (sector, change_percent, datetime.now().isoformat()),
      )
      conn.commit()
    finally:
      self.close()

  def get_sector_performance(self) -> list:
    """Return cached sector performance records."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        "SELECT * FROM sector_performance ORDER BY change_percent DESC"
      )
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  # ============================================================================
  # MARKET MOVERS
  # ============================================================================
  def clear_market_movers(self):
    """Remove existing market mover rows."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute("DELETE FROM market_movers")
      conn.commit()
    finally:
      self.close()

  def insert_market_mover(
      self,
      ticker: str,
      name: str,
      price: float,
      change: float,
      change_percent: float,
      volume: int,
      category: str,
      market_cap: float = None,
  ):
    """Insert a single market mover row."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        """
        INSERT INTO market_movers
        (ticker, name, price, change, change_percent, volume, category, market_cap, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
          ticker,
          name,
          price,
          change,
          change_percent,
          volume,
          category,
          market_cap,
          datetime.now().isoformat(),
        ),
      )
      conn.commit()
    finally:
      self.close()

  def get_market_movers(self, category: str = None) -> list:
    """Retrieve movers, optionally filtered by category."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      if category:
        cursor.execute(
          "SELECT * FROM market_movers WHERE category = ? ORDER BY change_percent DESC",
          (category,),
        )
      else:
        cursor.execute("SELECT * FROM market_movers ORDER BY change_percent DESC")
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  # ============================================================================
  # EARNINGS CALENDAR
  # ============================================================================
  def insert_or_update_earning(
      self,
      ticker: str,
      company_name: str,
      report_date: str,
      fiscal_period: str,
      eps_estimate: float = None,
      eps_actual: float = None,
      revenue_estimate: float = None,
      revenue_actual: float = None,
      time: str = None,
  ):
    """Insert or update an earnings calendar entry."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        """
        INSERT OR REPLACE INTO earnings_calendar
        (ticker, company_name, report_date, fiscal_period, eps_estimate, eps_actual,
         revenue_estimate, revenue_actual, time, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
          ticker,
          company_name,
          report_date,
          fiscal_period,
          eps_estimate,
          eps_actual,
          revenue_estimate,
          revenue_actual,
          time,
          datetime.now().isoformat(),
        ),
      )
      conn.commit()
    finally:
      self.close()

  def get_earnings_calendar(self, from_date: str = None, to_date: str = None) -> list:
    """Retrieve earnings calendar entries."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      if from_date and to_date:
        cursor.execute(
          """
          SELECT * FROM earnings_calendar
          WHERE report_date BETWEEN ? AND ?
          ORDER BY report_date ASC
          """,
          (from_date, to_date),
        )
      else:
        cursor.execute("SELECT * FROM earnings_calendar ORDER BY report_date ASC")
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  # ============================================================================
  # NEWS ARTICLES
  # ============================================================================
  def upsert_news_articles_bulk(self, articles: List[dict]) -> int:
    """Upsert multiple news articles keyed by URL."""
    if not articles:
      return 0
    conn = self.connect()
    cursor = conn.cursor()
    inserted = 0
    try:
      for item in articles:
        cursor.execute(
          """
          INSERT OR REPLACE INTO news_articles
          (ticker, title, url, published_date, snippet, site, publisher, image, last_cached)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          (
            item.get("ticker"),
            item.get("title"),
            item.get("url"),
            item.get("published_date"),
            item.get("snippet"),
            item.get("site"),
            item.get("publisher"),
            item.get("image"),
            datetime.now().isoformat(),
          ),
        )
        inserted += 1
      conn.commit()
      return inserted
    finally:
      self.close()

  def get_news_general(self, limit: int = 50) -> List[dict]:
    """Get recent general market news."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        """
        SELECT * FROM news_articles
        WHERE ticker IS NULL
        ORDER BY published_date DESC
        LIMIT ?
        """,
        (limit,),
      )
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  def get_news_for_ticker(self, ticker: str, limit: int = 50) -> List[dict]:
    """Get news for a specific ticker."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        """
        SELECT * FROM news_articles
        WHERE ticker = ?
        ORDER BY published_date DESC
        LIMIT ?
        """,
        (ticker.upper(), limit),
      )
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  def prune_news(self, max_age_days: int = 7) -> int:
    """Delete news articles older than max_age_days based on last_cached."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cutoff = (datetime.now() - timedelta(days=max_age_days)).isoformat()
      cursor.execute(
        "DELETE FROM news_articles WHERE last_cached < ?",
        (cutoff,),
      )
      deleted = cursor.rowcount
      conn.commit()
      return deleted
    finally:
      self.close()

  # ============================================================================
  # SECTOR PERFORMANCE HISTORY
  # ============================================================================
  def upsert_sector_history_bulk(self, rows: List[dict]) -> int:
    """Insert or replace sector performance history rows."""
    if not rows:
      return 0
    conn = self.connect()
    cursor = conn.cursor()
    inserted = 0
    try:
      for row in rows:
        cursor.execute(
          """
          INSERT OR REPLACE INTO sector_performance_history
          (date, sector, exchange, average_change, last_cached)
          VALUES (?, ?, ?, ?, ?)
          """,
          (
            row.get("date"),
            row.get("sector"),
            row.get("exchange"),
            row.get("average_change"),
            datetime.now().isoformat(),
          ),
        )
        inserted += 1
      conn.commit()
      return inserted
    finally:
      self.close()

  def get_latest_sector_history_date(self) -> Optional[str]:
    """Return latest date stored in sector_performance_history."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        "SELECT MAX(date) as latest_date FROM sector_performance_history"
      )
      row = cursor.fetchone()
      return row["latest_date"] if row and row["latest_date"] else None
    finally:
      self.close()

  def get_sector_history(self, start_date: str = None, end_date: str = None) -> List[dict]:
    """Fetch sector history rows between dates (inclusive)."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      if start_date and end_date:
        cursor.execute(
          """
          SELECT date, sector, exchange, average_change
          FROM sector_performance_history
          WHERE date BETWEEN ? AND ?
          ORDER BY date DESC
          """,
          (start_date, end_date),
        )
      elif start_date:
        cursor.execute(
          """
          SELECT date, sector, exchange, average_change
          FROM sector_performance_history
          WHERE date >= ?
          ORDER BY date DESC
          """,
          (start_date,),
        )
      else:
        cursor.execute(
          """
          SELECT date, sector, exchange, average_change
          FROM sector_performance_history
          ORDER BY date DESC
          """
        )
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  # ============================================================================
  # PRICE BARS
  # ============================================================================
  def upsert_price_bars_bulk(self, bars: List[dict]) -> int:
    """Insert or replace multiple price bars."""
    if not bars:
      return 0
    conn = self.connect()
    cursor = conn.cursor()
    inserted = 0
    try:
      for bar in bars:
        cursor.execute(
          """
          INSERT OR REPLACE INTO price_bars
          (symbol, timeframe, bar_time, open, high, low, close, volume, source, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          (
            bar.get("symbol"),
            bar.get("timeframe"),
            bar.get("bar_time"),
            bar.get("open"),
            bar.get("high"),
            bar.get("low"),
            bar.get("close"),
            bar.get("volume"),
            bar.get("source"),
            datetime.now().isoformat(),
          ),
        )
        inserted += 1
      conn.commit()
      return inserted
    finally:
      self.close()

  def get_price_bars(
      self,
      symbol: str,
      timeframe: str,
      limit: int = 300,
      start_time: str = None,
      end_time: str = None,
  ) -> List[dict]:
    """Retrieve price bars for a symbol/timeframe ordered newest -> oldest."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      params = [symbol, timeframe]
      query = """
        SELECT symbol, timeframe, bar_time, open, high, low, close, volume, source
        FROM price_bars
        WHERE symbol = ? AND timeframe = ?
      """
      if start_time:
        query += " AND bar_time >= ?"
        params.append(start_time)
      if end_time:
        query += " AND bar_time <= ?"
        params.append(end_time)
      query += " ORDER BY bar_time DESC LIMIT ?"
      params.append(limit)
      cursor.execute(query, tuple(params))
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  def get_eod_last_updated(self, symbol: str) -> Optional[str]:
    """Get the last_updated timestamp for EOD data of a symbol."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        """
        SELECT last_updated FROM price_bars
        WHERE symbol = ? AND timeframe = '1day'
        ORDER BY last_updated DESC LIMIT 1
        """,
        (symbol,),
      )
      row = cursor.fetchone()
      return row["last_updated"] if row else None
    finally:
      self.close()

  def delete_eod_bars(self, symbol: str) -> int:
    """Delete all EOD bars for a symbol (used for cache invalidation)."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        "DELETE FROM price_bars WHERE symbol = ? AND timeframe = '1day'",
        (symbol,),
      )
      deleted = cursor.rowcount
      conn.commit()
      return deleted
    finally:
      self.close()

  def get_intraday_last_updated(self, symbol: str, timeframe: str = "5min") -> Optional[str]:
    """Get the last_updated timestamp for intraday data of a symbol."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        """
        SELECT last_updated FROM price_bars
        WHERE symbol = ? AND timeframe = ?
        ORDER BY last_updated DESC LIMIT 1
        """,
        (symbol, timeframe),
      )
      row = cursor.fetchone()
      return row["last_updated"] if row else None
    finally:
      self.close()

  def delete_intraday_bars(self, symbol: str, timeframe: str = "5min") -> int:
    """Delete all intraday bars for a symbol/timeframe (used for cache invalidation)."""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute(
        "DELETE FROM price_bars WHERE symbol = ? AND timeframe = ?",
        (symbol, timeframe),
      )
      deleted = cursor.rowcount
      conn.commit()
      return deleted
    finally:
      self.close()

  # ============================================================================
  # ALTERNATIVE ASSETS METHODS
  # ============================================================================
  def insert_or_update_alternative_asset(
      self,
      symbol: str,
      name: str,
      asset_type: str,
      value: float = None,
      change: float = None,
      change_percent: float = None,
      fetch_error: str = None,
  ):
      """Insert or update an alternative asset (crypto, commodity, currency)."""
      conn = self.connect()
      cursor = conn.cursor()
      try:
          cursor.execute(
              """
              INSERT OR REPLACE INTO alternative_assets
              (symbol, name, asset_type, value, change, change_percent, last_updated, fetch_error)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              """,
              (
                  symbol,
                  name,
                  asset_type,
                  value,
                  change,
                  change_percent,
                  datetime.now().isoformat(),
                  fetch_error,
              ),
          )
          conn.commit()
      finally:
          self.close()

  def get_all_alternative_assets(self) -> List[dict]:
      """Return all alternative assets."""
      conn = self.connect()
      cursor = conn.cursor()
      try:
          cursor.execute("SELECT * FROM alternative_assets")
          rows = cursor.fetchall()
          return [dict(row) for row in rows]
      finally:
          self.close()

  # ============================================================================
  # MACRO INDICATORS METHODS
  # ============================================================================
  def insert_or_update_indicator(self, indicator_id: str, name: str,
                                 value: float, change: float = None,
                                 unit: str = '%'):
    """Insert or update a macro indicator"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('''
        INSERT OR REPLACE INTO macro_indicators 
        (indicator_id, name, value, change, unit, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
      ''', (indicator_id, name, value, change, unit, datetime.now().isoformat()))
      conn.commit()
    finally:
      self.close()

  def get_all_indicators(self) -> List[dict]:
    """Get all macro indicators"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('SELECT * FROM macro_indicators')
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  # ============================================================================
  # HISTORICAL DATA METHODS
  # ============================================================================
  def insert_treasury_history(self, date: str, yield_10y: float, yield_2y: float = None):
    """Insert treasury yield data"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('''
        INSERT OR REPLACE INTO treasury_history 
        (date, yield_10y, yield_2y, last_updated)
        VALUES (?, ?, ?, ?)
      ''', (date, yield_10y, yield_2y, datetime.now().isoformat()))
      conn.commit()
    finally:
      self.close()

  def get_treasury_history(self, days: int = 365) -> List[dict]:
    """Get treasury yield history"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
      cursor.execute('''
        SELECT date, yield_10y, yield_2y FROM treasury_history 
        WHERE date >= ? 
        ORDER BY date ASC
      ''', (cutoff_date,))
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()

  def insert_cpi_history(self, date: str, cpi_value: float,
                         mom_change: float = None, yoy_change: float = None):
    """Insert CPI historical data"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('''
        INSERT OR REPLACE INTO cpi_history 
        (date, cpi_value, mom_change, yoy_change, last_updated)
        VALUES (?, ?, ?, ?, ?)
      ''', (date, cpi_value, mom_change, yoy_change, datetime.now().isoformat()))
      conn.commit()
    finally:
      self.close()

  def get_cpi_history(self, months: int = 12) -> List[dict]:
    """Get CPI history"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('''
        SELECT date, cpi_value, mom_change, yoy_change FROM cpi_history 
        ORDER BY date DESC 
        LIMIT ?
      ''', (months,))
      rows = cursor.fetchall()
      # reverse to oldest -> newest
      result = [dict(row) for row in rows]
      return list(reversed(result))
    finally:
      self.close()

  def insert_vix_history(self, date: str, vix_close: float,
                         vix_high: float = None, vix_low: float = None):
    """Insert VIX historical data"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cursor.execute('''
        INSERT OR REPLACE INTO vix_history 
        (date, vix_close, vix_high, vix_low, last_updated)
        VALUES (?, ?, ?, ?, ?)
      ''', (date, vix_close, vix_high, vix_low, datetime.now().isoformat()))
      conn.commit()
    finally:
      self.close()

  def get_vix_history(self, days: int = 365) -> List[dict]:
    """Get VIX history"""
    conn = self.connect()
    cursor = conn.cursor()
    try:
      cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
      cursor.execute('''
        SELECT date, vix_close, vix_high, vix_low FROM vix_history 
        WHERE date >= ? 
        ORDER BY date ASC
      ''', (cutoff_date,))
      rows = cursor.fetchall()
      return [dict(row) for row in rows]
    finally:
      self.close()


# Global database instance
db = DatabaseManager()

