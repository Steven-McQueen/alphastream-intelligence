"""Chart data endpoints for stocks and indices."""

from datetime import datetime, timedelta

import pytz
from fastapi import APIRouter, HTTPException

from services.fmp_client import fmp_client
from services.price_history_importer import get_or_fetch_intraday, get_or_fetch_eod
from routes.market import INDEX_SYMBOL_MAP

router = APIRouter()

_ET_TZ = pytz.timezone("US/Eastern")


def _fmp_index_symbol(symbol: str) -> str:
    """Map app index symbols (SPX, ^SPX, NDX, ...) to FMP symbols available on
    the current plan (^GSPC, ^IXIC, ...). ^SPX/^NDX are premium-only at FMP."""
    sym = symbol.upper()
    mapped = INDEX_SYMBOL_MAP.get(sym) or INDEX_SYMBOL_MAP.get(sym.lstrip("^"))
    if mapped:
        return mapped
    return sym if sym.startswith("^") else f"^{sym}"


def _classify_session(ts_ms) -> str:
    """Return 'pre' or 'post' for an extended-hours timestamp (ms) in ET."""
    try:
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=_ET_TZ)
        minutes = dt.hour * 60 + dt.minute
        # Regular session is 09:30-16:00 ET; before = pre-market, after = post-market.
        return "pre" if minutes < 9 * 60 + 30 else "post"
    except Exception:
        return "post"


@router.get("/api/stock/{ticker}/aftermarket")
def get_stock_aftermarket(ticker: str):
    """Latest extended-hours price for a ticker (single point), with change vs the
    most recent regular-session close. Used to render the '1D' after-hours marker."""
    symbol = ticker.upper()
    try:
        quote = None
        trade = None
        try:
            quote = fmp_client.get_aftermarket_quote(symbol)
        except Exception as exc:
            print(f"[AFTERMARKET] quote failed for {symbol}: {exc}")
        try:
            trade = fmp_client.get_aftermarket_trade(symbol)
        except Exception as exc:
            print(f"[AFTERMARKET] trade failed for {symbol}: {exc}")

        # Prefer last trade price; fall back to mid of bid/ask.
        price = None
        timestamp = None
        if trade and trade.get("price"):
            price = trade.get("price")
            timestamp = trade.get("timestamp")
        if price is None and quote:
            bid = quote.get("bidPrice")
            ask = quote.get("askPrice")
            if bid and ask:
                price = (bid + ask) / 2
            elif bid or ask:
                price = bid or ask
            timestamp = timestamp or quote.get("timestamp")

        if price is None:
            return {"symbol": symbol, "available": False}

        # Most recent regular-session close for the change calculation.
        prev_close = None
        try:
            eod = get_or_fetch_eod(symbol, limit=2)
            if eod:
                prev_close = eod[-1].get("close")
        except Exception as exc:
            print(f"[AFTERMARKET] prevClose lookup failed for {symbol}: {exc}")

        change = None
        change_percent = None
        if prev_close:
            change = price - prev_close
            change_percent = (change / prev_close) * 100 if prev_close else None

        return {
            "symbol": symbol,
            "available": True,
            "price": price,
            "prevClose": prev_close,
            "change": change,
            "changePercent": change_percent,
            "timestamp": timestamp,
            "session": _classify_session(timestamp) if timestamp else "post",
        }
    except Exception as exc:
        print(f"Error in get_stock_aftermarket: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/stock/{ticker}/chart")
def get_stock_chart(ticker: str, timeframe: str = "1day", limit: int = 1300):
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


@router.get("/api/stock/{ticker}/peers")
def get_peers(ticker: str, limit: int = 6):
    """Similar companies (peers) for a ticker, enriched with live quote data."""
    symbol = ticker.upper()
    try:
        peers = fmp_client.get_stock_peers(symbol)[:limit]
        if not peers:
            return []
        quotes = fmp_client.get_batch_quotes_optimized(peers)
        by_sym = {q.get("symbol"): q for q in quotes if q.get("symbol")}
        result = []
        for p in peers:
            q = by_sym.get(p, {})
            result.append({
                "symbol": p,
                "name": q.get("name") or p,
                "price": q.get("price"),
                "changePercent": q.get("changesPercentage"),
                "marketCap": q.get("marketCap"),
            })
        return result
    except Exception as exc:
        print(f"Error in get_peers: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# Annual-report form types (US 10-K + foreign-filer equivalents).
_ANNUAL_FORMS = {"10-K", "10-K/A", "10-KSB", "20-F", "20-F/A", "40-F", "40-F/A"}


@router.get("/api/stock/{ticker}/annual-reports")
def get_annual_reports(ticker: str, limit: int = 12):
    """Annual reports (10-K and foreign equivalents) with direct SEC EDGAR links."""
    symbol = ticker.upper()
    to_date = datetime.now().strftime("%Y-%m-%d")
    from_date = (datetime.now() - timedelta(days=365 * 15)).strftime("%Y-%m-%d")
    try:
        filings = fmp_client.get_sec_filings(symbol, from_date, to_date, limit=1000) or []
        reports = []
        for f in filings:
            form = (f.get("formType") or "").upper()
            if form not in _ANNUAL_FORMS:
                continue
            filing_date = (f.get("filingDate") or "")[:10]
            reports.append({
                "form": f.get("formType"),
                "filingDate": filing_date,
                "year": filing_date[:4] if filing_date else None,
                "cik": f.get("cik"),
                "link": f.get("link"),          # SEC filing index page
                "finalLink": f.get("finalLink"),  # direct document
            })

        # newest first, de-duplicated by (form, filingDate)
        seen = set()
        out = []
        for r in sorted(reports, key=lambda x: x["filingDate"], reverse=True):
            key = (r["form"], r["filingDate"])
            if key in seen:
                continue
            seen.add(key)
            out.append(r)
        return out[:limit]
    except Exception as exc:
        print(f"Error in get_annual_reports: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/stock/{ticker}/insider-trades")
def get_insider_trades(ticker: str, limit: int = 15):
    """Recent insider (exec / 10% owner) trades for a ticker, newest first.

    Distinct from the congressional trades shown on the Politicians tab.
    """
    symbol = ticker.upper()
    try:
        raw = fmp_client.get_insider_trades(symbol, limit=50) or []
        trades = []
        for t in raw:
            disp = (t.get("acquisitionOrDisposition") or "").upper()
            # A = acquired (buy), D = disposed (sell). Fall back to transactionType text.
            if disp == "A":
                side = "Buy"
            elif disp == "D":
                side = "Sell"
            else:
                ttype = (t.get("transactionType") or "").upper()
                side = "Buy" if ttype.startswith("P") else ("Sell" if ttype.startswith("S") else "Other")

            shares = t.get("securitiesTransacted")
            price = t.get("price")
            value = None
            try:
                if shares is not None and price is not None:
                    value = float(shares) * float(price)
            except (TypeError, ValueError):
                value = None

            trades.append({
                "date": (t.get("transactionDate") or t.get("filingDate") or "")[:10],
                "name": t.get("reportingName"),
                "position": t.get("typeOfOwner"),
                "type": side,
                "shares": shares,
                "price": price,
                "value": value,
            })

        # newest first by date
        trades.sort(key=lambda x: x["date"] or "", reverse=True)
        return trades[:limit]
    except Exception as exc:
        print(f"Error in get_insider_trades: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/index/{symbol}/chart")
def get_index_chart(symbol: str, timeframe: str = "1day", limit: int = 2000):
    """Get chart data for an index symbol."""
    try:
        symbol = _fmp_index_symbol(symbol)

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
        symbol = _fmp_index_symbol(symbol)
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
        symbol = _fmp_index_symbol(symbol)
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
