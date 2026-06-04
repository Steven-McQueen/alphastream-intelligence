"""FMP data accessors for chat grounding.

This is the single data layer the chat copilot uses to read real market
data. Each accessor returns a plain ``dict`` (or ``None``) so the same
functions can back both Phase 1 context-injection (see ``grounding.py``)
and a future Phase 2 tool/function-calling implementation without change.

All FMP calls are sync (``requests``); callers on the async path must run
``gather_symbol_data`` in an executor. Within a single gather the per-domain
calls are fanned out across a thread pool to keep latency to ~one call deep.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from services.fmp_client import fmp_client

logger = logging.getLogger(__name__)

# Domain identifiers used by the resolver/formatter and (later) tool specs.
DOMAIN_SNAPSHOT = "snapshot"
DOMAIN_FUNDAMENTALS = "fundamentals"
DOMAIN_ANALYST = "analyst"
DOMAIN_NEWS = "news"

DEFAULT_DOMAINS = (
    DOMAIN_SNAPSHOT,
    DOMAIN_FUNDAMENTALS,
    DOMAIN_ANALYST,
    DOMAIN_NEWS,
)


def _first(data: Any) -> Dict[str, Any]:
    """Return the first dict from an FMP list response, else an empty dict."""
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    if isinstance(data, dict):
        return data
    return {}


def company_snapshot(symbol: str) -> Optional[Dict[str, Any]]:
    """Live quote + company profile merged into one snapshot dict."""
    try:
        quote = fmp_client.get_quote(symbol) or {}
        profile = _first(fmp_client.get_company_profile(symbol))
        if not quote and not profile:
            return None
        return {
            "symbol": symbol,
            "name": quote.get("name") or profile.get("companyName"),
            "price": quote.get("price"),
            "change": quote.get("change"),
            "changePercent": quote.get("changesPercentage"),
            "dayLow": quote.get("dayLow"),
            "dayHigh": quote.get("dayHigh"),
            "yearLow": quote.get("yearLow"),
            "yearHigh": quote.get("yearHigh"),
            "priceAvg50": quote.get("priceAvg50"),
            "priceAvg200": quote.get("priceAvg200"),
            "volume": quote.get("volume"),
            "marketCap": quote.get("marketCap") or profile.get("marketCap"),
            "exchange": profile.get("exchange") or quote.get("exchange"),
            "currency": profile.get("currency"),
            "sector": profile.get("sector"),
            "industry": profile.get("industry"),
            "beta": profile.get("beta"),
            "ceo": profile.get("ceo"),
            "employees": profile.get("fullTimeEmployees"),
            "country": profile.get("country"),
            "ipoDate": profile.get("ipoDate"),
            "website": profile.get("website"),
            "description": profile.get("description"),
        }
    except Exception as exc:
        logger.warning("[GROUNDING] company_snapshot(%s) failed: %s", symbol, exc)
        return None


def fundamentals(symbol: str) -> Optional[Dict[str, Any]]:
    """Latest annual key metrics + ratios (valuation, margins, returns)."""
    try:
        metrics = _first(fmp_client.get_key_metrics(symbol, period="annual", limit=1))
        ratios = _first(fmp_client.get_ratios(symbol, period="annual", limit=1))
        if not metrics and not ratios:
            return None
        return {
            "symbol": symbol,
            "fiscalYear": ratios.get("fiscalYear") or metrics.get("fiscalYear"),
            "pe": ratios.get("priceToEarningsRatio"),
            "ps": ratios.get("priceToSalesRatio"),
            "pb": ratios.get("priceToBookRatio"),
            "grossMargin": ratios.get("grossProfitMargin"),
            "operatingMargin": ratios.get("operatingProfitMargin"),
            "netMargin": ratios.get("netProfitMargin"),
            "debtToEquity": ratios.get("debtToEquityRatio"),
            "currentRatio": ratios.get("currentRatio"),
            "interestCoverage": ratios.get("interestCoverageRatio"),
            "roe": metrics.get("returnOnEquity"),
            "roic": metrics.get("returnOnInvestedCapital"),
            "fcfYield": metrics.get("freeCashFlowYield"),
            "evToEbitda": metrics.get("evToEBITDA"),
            "netDebtToEbitda": metrics.get("netDebtToEBITDA"),
        }
    except Exception as exc:
        logger.warning("[GROUNDING] fundamentals(%s) failed: %s", symbol, exc)
        return None


def analyst_view(symbol: str) -> Optional[Dict[str, Any]]:
    """Rating consensus, price-target summary, and latest forward estimate."""
    try:
        grades = _first(fmp_client.get_grades_consensus(symbol))
        targets = _first(fmp_client.get_price_target_summary(symbol))
        estimate = _first(
            fmp_client.get_analyst_estimates(symbol, period="annual", limit=1)
        )
        if not grades and not targets and not estimate:
            return None
        return {
            "symbol": symbol,
            "consensus": grades.get("consensus"),
            "strongBuy": grades.get("strongBuy"),
            "buy": grades.get("buy"),
            "hold": grades.get("hold"),
            "sell": grades.get("sell"),
            "strongSell": grades.get("strongSell"),
            "targetAvg": (
                targets.get("lastQuarterAvgPriceTarget")
                or targets.get("lastMonthAvgPriceTarget")
                or targets.get("allTimeAvgPriceTarget")
            ),
            "targetAnalysts": (
                targets.get("lastQuarterCount") or targets.get("lastMonthCount")
            ),
            "estimateDate": estimate.get("date"),
            "epsAvg": estimate.get("epsAvg"),
            "revenueAvg": estimate.get("revenueAvg"),
        }
    except Exception as exc:
        logger.warning("[GROUNDING] analyst_view(%s) failed: %s", symbol, exc)
        return None


def recent_news(symbol: str, limit: int = 3) -> Optional[List[Dict[str, Any]]]:
    """Most recent company-specific news headlines."""
    try:
        items = fmp_client.get_news_for_symbols([symbol], limit=limit) or []
        out = [
            {
                "title": it.get("title"),
                "publisher": it.get("publisher") or it.get("site"),
                "date": (it.get("publishedDate") or "")[:10],
            }
            for it in items[:limit]
            if it.get("title")
        ]
        return out or None
    except Exception as exc:
        logger.warning("[GROUNDING] recent_news(%s) failed: %s", symbol, exc)
        return None


# Map a domain id to its accessor and the result key it populates.
_DOMAIN_ACCESSORS = {
    DOMAIN_SNAPSHOT: ("snapshot", company_snapshot),
    DOMAIN_FUNDAMENTALS: ("fundamentals", fundamentals),
    DOMAIN_ANALYST: ("analyst", analyst_view),
    DOMAIN_NEWS: ("news", recent_news),
}


def gather_symbol_data(
    symbol: str,
    domains: tuple[str, ...] = DEFAULT_DOMAINS,
) -> Dict[str, Any]:
    """Fetch the requested domains for one symbol, fanning out the FMP calls.

    Returns a dict keyed by result-name (snapshot/fundamentals/analyst/news);
    domains that error or return nothing are simply omitted.
    """
    selected = [d for d in domains if d in _DOMAIN_ACCESSORS]
    result: Dict[str, Any] = {"symbol": symbol}
    if not selected:
        return result

    with ThreadPoolExecutor(max_workers=len(selected)) as pool:
        futures = {
            key: pool.submit(fn, symbol)
            for d in selected
            for (key, fn) in (_DOMAIN_ACCESSORS[d],)
        }
        for key, fut in futures.items():
            try:
                value = fut.result()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("[GROUNDING] %s(%s) raised: %s", key, symbol, exc)
                value = None
            if value:
                result[key] = value
    return result
