"""
Financial Modeling Prep API client.
"""

import os
import time
from pathlib import Path
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")


class FMPClient:
    """Financial Modeling Prep API Client"""

    BASE_URL = "https://financialmodelingprep.com/api/v3"

    def __init__(self) -> None:
        self.api_key = os.getenv("FMP_API_KEY")
        if not self.api_key:
            raise ValueError("FMP_API_KEY not found in .env file")

    def _make_request(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """
        Make API request to FMP.
        Handles both /v3/ (legacy) and /stable/ endpoints.
        """
        params = params or {}
        params["apikey"] = self.api_key

        # Stable endpoints live under https://financialmodelingprep.com/stable/...
        # (no /api prefix), while legacy endpoints are under /api/v3.
        if endpoint.startswith("/stable/"):
            url = f"https://financialmodelingprep.com{endpoint}"
        else:
            url = f"{self.BASE_URL}{endpoint}"

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as exc:
            print(f"[FMP] Error calling {endpoint}: {exc}")
            raise

    # ========= STOCK QUOTES =========
    def get_quote(self, symbol: str) -> Optional[Dict]:
        """
        Get real-time quote for a single stock using stable /quote.
        Example: https://financialmodelingprep.com/stable/quote?symbol=BRK-B
        """
        try:
            data = self._make_request("/stable/quote", params={"symbol": symbol})
            if not isinstance(data, list) or not data:
                return None

            item = data[0]
            return {
                "symbol": item.get("symbol"),
                "name": item.get("name"),
                "price": item.get("price", 0),
                "change": item.get("change", 0),
                "changesPercentage": item.get("changePercentage", 0),
                "volume": item.get("volume"),
                "dayLow": item.get("dayLow"),
                "dayHigh": item.get("dayHigh"),
                "yearHigh": item.get("yearHigh"),
                "yearLow": item.get("yearLow"),
                "marketCap": item.get("marketCap"),
                "priceAvg50": item.get("priceAvg50"),
                "priceAvg200": item.get("priceAvg200"),
                "open": item.get("open"),
                "previousClose": item.get("previousClose"),
                "exchange": item.get("exchange"),
                "timestamp": item.get("timestamp"),
            }
        except Exception as e:
            print(f"[FMP] Error getting quote for {symbol}: {e}")
            return None

    def get_batch_quotes(self, symbols: List[str]) -> List[Dict]:
        """
        Get quotes for multiple stocks by aggregating single-symbol calls.
        """
        if not symbols:
            return []

        results: List[Dict] = []
        for symbol in symbols:
            quote = self.get_quote(symbol)
            if quote:
                results.append(quote)
            time.sleep(0.05)
        return results

    # ========= NEWS (STABLE) =========
    def get_general_latest_news(self, page: int = 0, limit: int = 20) -> List[Dict]:
        """General market news feed."""
        return self._make_request(
            "/stable/news/general-latest", params={"page": page, "limit": limit}
        )

    def get_stock_latest_news(self, page: int = 0, limit: int = 20) -> List[Dict]:
        """Latest mixed stock news feed."""
        return self._make_request(
            "/stable/news/stock-latest", params={"page": page, "limit": limit}
        )

    def get_news_for_symbols(self, symbols: List[str], limit: int = 20) -> List[Dict]:
        """News for specific symbols."""
        if not symbols:
            return []
        symbols_csv = ",".join(symbols)
        return self._make_request(
            "/stable/news/stock", params={"symbols": symbols_csv, "limit": limit}
        )

    # ========= PRICE HISTORY =========
    def get_intraday_chart(self, symbol: str, interval: str = "5min") -> List[Dict]:
        """Intraday price bars."""
        return self._make_request(
            f"/stable/historical-chart/{interval}", params={"symbol": symbol}
        )

    def get_eod_history(
        self, symbol: str, adjusted: bool = False, limit: int = None
    ) -> List[Dict]:
        """
        End-of-day price history using /stable/historical-price-eod/full.
        This endpoint returns data with proper open, high, low, close fields
        (not adjOpen, adjHigh, etc.), eliminating the need for field normalization.
        """
        endpoint = "/stable/historical-price-eod/full"
        params = {"symbol": symbol}
        if limit:
            params["limit"] = limit
        return self._make_request(endpoint, params=params)
    # ========= MARKET SNAPSHOTS =========
    def get_sector_performance_snapshot(self, date: str = None, exchange: str = None) -> List[Dict]:
        params = {}
        if date:
            params["date"] = date
        if exchange:
            params["exchange"] = exchange
        return self._make_request("/stable/sector-performance-snapshot", params=params)

    def get_biggest_gainers(self) -> List[Dict]:
        return self._make_request("/stable/biggest-gainers")

    def get_biggest_losers(self) -> List[Dict]:
        return self._make_request("/stable/biggest-losers")

    def get_earnings_calendar_range(self, from_date: str, to_date: str) -> List[Dict]:
        """Earnings calendar for a date range."""
        return self._make_request(
            "/stable/earnings-calendar", params={"from": from_date, "to": to_date}
        )

    def get_index_intraday_chart(self, symbol: str, interval: str = "5min") -> List[Dict]:
        """
        Intraday chart for index symbols (e.g., ^GSPC) using stable endpoint.
        """
        return self._make_request(
            f"/stable/historical-chart/{interval}", params={"symbol": symbol}
        )

    def get_company_profile(self, symbol: str) -> List[Dict]:
        """
        Get company profile including description, logo, CEO, employees, etc.
        https://financialmodelingprep.com/stable/profile?symbol=AAPL
        """
        return self._make_request("/stable/profile", params={"symbol": symbol})

    # ========= FINANCIAL STATEMENTS =========
    def get_income_statement(self, symbol: str, period: str = "annual", limit: int = 5) -> List[Dict]:
        """
        Get income statement data.
        period: 'annual' or 'quarter'
        https://financialmodelingprep.com/stable/income-statement?symbol=AAPL&period=annual
        """
        return self._make_request(
            "/stable/income-statement",
            params={"symbol": symbol, "period": period, "limit": limit}
        )

    def get_balance_sheet(self, symbol: str, period: str = "annual", limit: int = 5) -> List[Dict]:
        """
        Get balance sheet data.
        period: 'annual' or 'quarter'
        https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=AAPL&period=annual
        """
        return self._make_request(
            "/stable/balance-sheet-statement",
            params={"symbol": symbol, "period": period, "limit": limit}
        )

    def get_cash_flow_statement(self, symbol: str, period: str = "annual", limit: int = 5) -> List[Dict]:
        """
        Get cash flow statement data.
        period: 'annual' or 'quarter'
        https://financialmodelingprep.com/stable/cash-flow-statement?symbol=AAPL&period=annual
        """
        return self._make_request(
            "/stable/cash-flow-statement",
            params={"symbol": symbol, "period": period, "limit": limit}
        )

    def get_key_metrics(self, symbol: str, period: str = "annual", limit: int = 5) -> List[Dict]:
        """
        Get key financial metrics.
        https://financialmodelingprep.com/stable/key-metrics?symbol=AAPL&period=annual
        """
        return self._make_request(
            "/stable/key-metrics",
            params={"symbol": symbol, "period": period, "limit": limit}
        )

    # ========= ANALYST RATINGS & ESTIMATES =========
    def get_analyst_estimates(self, symbol: str, period: str = "annual", limit: int = 10) -> List[Dict]:
        """
        Get analyst estimates for EPS, revenue, etc.
        https://financialmodelingprep.com/stable/analyst-estimates?symbol=AAPL
        """
        return self._make_request(
            "/stable/analyst-estimates",
            params={"symbol": symbol, "period": period, "limit": limit}
        )

    def get_ratings_historical(self, symbol: str, limit: int = 30) -> List[Dict]:
        """
        Get historical stock ratings (Strong Buy/Buy/Hold/Sell/Strong Sell counts).
        https://financialmodelingprep.com/stable/ratings-historical?symbol=AAPL
        """
        return self._make_request(
            "/stable/ratings-historical",
            params={"symbol": symbol, "limit": limit}
        )

    def get_grades_consensus(self, symbol: str) -> List[Dict]:
        """
        Get analyst grades consensus (buy, overweight, hold, sell, etc.).
        https://financialmodelingprep.com/stable/grades-consensus?symbol=AAPL
        """
        return self._make_request("/stable/grades-consensus", params={"symbol": symbol})

    def get_price_target_consensus(self, symbol: str) -> List[Dict]:
        """
        Get analyst price target consensus (avg, high, low, number of analysts).
        https://financialmodelingprep.com/stable/price-target-consensus?symbol=AAPL
        """
        return self._make_request("/stable/price-target-consensus", params={"symbol": symbol})

    def get_price_target_summary(self, symbol: str) -> List[Dict]:
        """
        Get price target summary with last month/quarter statistics.
        https://financialmodelingprep.com/stable/price-target-summary?symbol=AAPL
        """
        return self._make_request("/stable/price-target-summary", params={"symbol": symbol})

    def get_analyst_grades(self, symbol: str, limit: int = 30) -> List[Dict]:
        """
        Get individual analyst grades (upgrades/downgrades history).
        https://financialmodelingprep.com/stable/grades?symbol=AAPL
        """
        return self._make_request(
            "/stable/grades",
            params={"symbol": symbol, "limit": limit}
        )

    # Compatibility helpers
    def get_index_quotes(self) -> List[Dict]:
        """Legacy helper: returns quotes for major indices via stable /quote."""
        indices = ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX"]
        return self.get_batch_quotes(indices)

    def get_sector_performance(self) -> List[Dict]:
        """Legacy helper: returns latest sector performance snapshot."""
        return self.get_sector_performance_snapshot()


# Shared client instance
fmp_client = FMPClient()

