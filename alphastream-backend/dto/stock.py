"""Shared stock DB-row -> API-response mappers."""

from typing import Dict, Optional


def stock_to_list_item(stock: dict) -> dict:
    """Map a stock DB row to the compact list format used by /universe/core and /universe/search."""
    price = stock.get("price") or 0
    revenue_ttm = stock.get("revenue_ttm") or 0
    market_cap = stock.get("market_cap") or 0

    price_to_sales = None
    if revenue_ttm and revenue_ttm > 0 and market_cap:
        price_to_sales = market_cap / revenue_ttm

    return {
        "ticker": stock["ticker"],
        "name": stock["name"],
        "sector": stock["sector"],
        "industry": stock["industry"],
        "price": price,
        "change1D": stock["change_1d"],
        "change1W": stock["change_1w"],
        "change1M": stock["change_1m"],
        "change1Y": stock["change_1y"],
        "volume": stock["volume"],
        "peRatio": stock["pe_ratio"],
        "eps": stock["eps"],
        "dividendYield": stock["dividend_yield"],
        "marketCap": market_cap,
        "netProfitMargin": stock["net_profit_margin"],
        "grossMargin": stock["gross_margin"],
        "roe": stock["roe"],
        "revenue": revenue_ttm,
        "beta": stock["beta"],
        "sharesOutstanding": stock.get("shares_outstanding"),
        "debtToEquity": stock.get("debt_to_equity"),
        "priceToSales": price_to_sales,
        "institutionalOwnership": stock["institutional_ownership"],
        "yearFounded": stock["year_founded"],
        "website": stock["website"],
        "updatedAt": stock["last_updated"],
    }


def stock_to_detail(stock: dict, age_seconds: Optional[float] = None) -> dict:
    """Map a stock DB row to the full detail format used by /stock/{ticker}."""
    return {
        "ticker": stock["ticker"],
        "name": stock["name"],
        "sector": stock["sector"],
        "industry": stock["industry"],
        "price": stock["price"],
        "change1D": stock["change_1d"],
        "change1W": stock["change_1w"],
        "change1M": stock["change_1m"],
        "change1Y": stock["change_1y"],
        "change5Y": stock["change_5y"],
        "changeYTD": stock["change_ytd"],
        "volume": stock["volume"],
        "high1D": stock["high_1d"],
        "low1D": stock["low_1d"],
        "high1M": stock["high_1m"],
        "low1M": stock["low_1m"],
        "high1Y": stock["high_1y"],
        "low1Y": stock["low_1y"],
        "high5Y": stock["high_5y"],
        "low5Y": stock["low_5y"],
        "peRatio": stock["pe_ratio"],
        "eps": stock["eps"],
        "dividendYield": stock["dividend_yield"],
        "marketCap": stock["market_cap"],
        "sharesOutstanding": stock["shares_outstanding"],
        "netProfitMargin": stock["net_profit_margin"],
        "grossMargin": stock["gross_margin"],
        "roe": stock["roe"],
        "revenue": stock["revenue_ttm"],
        "beta": stock["beta"],
        "institutionalOwnership": stock["institutional_ownership"],
        "debtToEquity": stock["debt_to_equity"],
        "yearFounded": stock["year_founded"],
        "website": stock["website"],
        "city": stock["city"],
        "state": stock["state"],
        "zip": stock["zip"],
        "updatedAt": stock["last_updated"],
        "dataSource": stock["data_source"],
        "cacheAge": age_seconds,
    }
