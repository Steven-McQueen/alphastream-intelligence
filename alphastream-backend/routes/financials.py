"""Financial statement endpoints (/api/stock/{ticker}/financials/*)."""

from fastapi import APIRouter, HTTPException

from services.fmp_client import fmp_client

router = APIRouter(prefix="/api/stock")


@router.get("/{ticker}/financials/income")
def get_income_statement(ticker: str, period: str = "annual", limit: int = 5):
    """Get income statement data for a stock."""
    try:
        symbol = ticker.upper()
        data = fmp_client.get_income_statement(symbol, period=period, limit=limit)
        if not data:
            raise HTTPException(status_code=404, detail=f"Income statement not found for {ticker}")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching income statement for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/financials/balance")
def get_balance_sheet(ticker: str, period: str = "annual", limit: int = 5):
    """Get balance sheet data for a stock."""
    try:
        symbol = ticker.upper()
        data = fmp_client.get_balance_sheet(symbol, period=period, limit=limit)
        if not data:
            raise HTTPException(status_code=404, detail=f"Balance sheet not found for {ticker}")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching balance sheet for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/financials/cashflow")
def get_cash_flow(ticker: str, period: str = "annual", limit: int = 5):
    """Get cash flow statement data for a stock."""
    try:
        symbol = ticker.upper()
        data = fmp_client.get_cash_flow_statement(symbol, period=period, limit=limit)
        if not data:
            raise HTTPException(status_code=404, detail=f"Cash flow statement not found for {ticker}")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching cash flow for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/financials/metrics")
def get_key_metrics(ticker: str, period: str = "annual", limit: int = 5):
    """Get key financial metrics for a stock."""
    try:
        symbol = ticker.upper()
        data = fmp_client.get_key_metrics(symbol, period=period, limit=limit)
        if not data:
            raise HTTPException(status_code=404, detail=f"Key metrics not found for {ticker}")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching key metrics for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/financials/ratios")
def get_financial_ratios(ticker: str, period: str = "annual", limit: int = 5):
    """Get financial ratios (P/E, P/B, P/S, etc.) for a stock."""
    try:
        symbol = ticker.upper()
        data = fmp_client.get_ratios(symbol, period=period, limit=limit)
        if not data:
            raise HTTPException(status_code=404, detail=f"Financial ratios not found for {ticker}")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching financial ratios for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{ticker}/financials/all")
def get_all_financials(ticker: str, period: str = "annual", limit: int = 5):
    """Get all financial statements (income, balance, cashflow, metrics, ratios) in one call."""
    try:
        symbol = ticker.upper()

        income = fmp_client.get_income_statement(symbol, period=period, limit=limit) or []
        balance = fmp_client.get_balance_sheet(symbol, period=period, limit=limit) or []
        cashflow = fmp_client.get_cash_flow_statement(symbol, period=period, limit=limit) or []

        metrics = []
        try:
            metrics = fmp_client.get_key_metrics(symbol, period=period, limit=limit) or []
        except Exception as metrics_err:
            print(f"[WARN] Could not fetch key-metrics for {symbol} ({period}): {metrics_err}")

        ratios = []
        try:
            ratios = fmp_client.get_ratios(symbol, period=period, limit=limit) or []
        except Exception as ratios_err:
            print(f"[WARN] Could not fetch ratios for {symbol} ({period}): {ratios_err}")

        return {
            "income": income,
            "balance": balance,
            "cashflow": cashflow,
            "metrics": metrics,
            "ratios": ratios,
        }
    except Exception as exc:
        print(f"[ERROR] Error fetching all financials for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
