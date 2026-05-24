"""Chart data endpoints for stocks and indices."""

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from services.fmp_client import fmp_client
from services.price_history_importer import get_or_fetch_intraday, get_or_fetch_eod

router = APIRouter()


@router.get("/api/stock/{ticker}/chart")
def get_stock_chart(ticker: str, timeframe: str = "1day", limit: int = 2000):
    """Get cached chart data for a ticker and timeframe."""
    symbol = ticker.upper()
    tf = timeframe.lower()
    try:
        if tf in ["5min", "15min", "30min", "1hour"]:
            bars = get_or_fetch_intraday(symbol, interval=tf, limit=limit)
        elif tf in ["1day", "1d", "eod"]:
            bars = get_or_fetch_eod(symbol, limit=limit)
        else:
            raise HTTPException(status_code=400, detail="Unsupported timeframe")

        return [
            {
                "date": bar.get("bar_time"),
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": bar.get("volume"),
                "timeframe": bar.get("timeframe"),
            }
            for bar in bars
        ]
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in get_stock_chart: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/index/{symbol}/chart")
def get_index_chart(symbol: str, timeframe: str = "1day", limit: int = 2000):
    """Get chart data for an index symbol."""
    try:
        if not symbol.startswith("^"):
            symbol = f"^{symbol}"

        tf = timeframe.lower()

        if tf in ["5min", "15min", "30min", "1hour"]:
            bars = fmp_client.get_index_intraday_chart(symbol, interval=tf)
            return [
                {
                    "date": bar.get("date"),
                    "open": bar.get("open"),
                    "high": bar.get("high"),
                    "low": bar.get("low"),
                    "close": bar.get("close"),
                    "volume": bar.get("volume"),
                }
                for bar in bars[:limit]
            ]

        elif tf in ["1day", "1d", "eod"]:
            from_date = (datetime.now() - timedelta(days=int(limit * 1.5))).strftime("%Y-%m-%d")
            to_date = datetime.now().strftime("%Y-%m-%d")
            eod_data = fmp_client.get_index_eod_history(symbol, from_date=from_date, to_date=to_date)
            if not eod_data:
                return []
            return [
                {
                    "date": bar.get("date"),
                    "open": bar.get("open"),
                    "high": bar.get("high"),
                    "low": bar.get("low"),
                    "close": bar.get("close"),
                    "volume": bar.get("volume"),
                }
                for bar in eod_data[:limit]
            ]
        else:
            raise HTTPException(status_code=400, detail="Unsupported timeframe")

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in get_index_chart: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/index/{symbol}/quote")
def get_index_quote(symbol: str):
    """Get detailed quote for an index symbol."""
    try:
        print(f"[DATA] Fetching quote for index {symbol}")
        quote_data = fmp_client.get_quote(symbol)
        if not quote_data:
            raise HTTPException(status_code=404, detail=f"Quote not found for {symbol}")

        intraday = fmp_client.get_index_intraday_chart(symbol, interval="5min")

        day_high = quote_data.get("dayHigh")
        day_low = quote_data.get("dayLow")
        volume = quote_data.get("volume", 0)

        if intraday and (day_high is None or day_low is None):
            today_str = datetime.now().strftime("%Y-%m-%d")
            today_bars = [b for b in intraday if b.get("date", "").startswith(today_str)]
            if today_bars:
                day_high = max(b.get("high", 0) for b in today_bars)
                day_low = min(b.get("low", float("inf")) for b in today_bars)
                volume = sum(b.get("volume", 0) for b in today_bars)

        return {
            "symbol": quote_data.get("symbol") or symbol,
            "name": quote_data.get("name") or symbol,
            "price": quote_data.get("price"),
            "change": quote_data.get("change") or 0,
            "changePercent": quote_data.get("changesPercentage") or 0,
            "previousClose": quote_data.get("previousClose"),
            "open": quote_data.get("open"),
            "dayHigh": day_high,
            "dayLow": day_low,
            "yearHigh": quote_data.get("yearHigh"),
            "yearLow": quote_data.get("yearLow"),
            "volume": volume,
            "avgVolume": quote_data.get("avgVolume") or quote_data.get("priceAvg50"),
            "timestamp": quote_data.get("timestamp"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in get_index_quote: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/index/{symbol}/intraday")
def get_index_intraday(symbol: str, interval: str = "5min"):
    """Get intraday chart data for an index symbol."""
    try:
        print(f"[DATA] Fetching intraday chart for {symbol} at {interval}")
        chart_data = fmp_client.get_index_intraday_chart(symbol, interval=interval)
        if not chart_data:
            print(f"[WARN] No intraday data returned for {symbol}")
            return []
        return [
            {
                "date": bar.get("date"),
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": bar.get("volume"),
            }
            for bar in chart_data
        ]
    except Exception as exc:
        print(f"Error in get_index_intraday: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
