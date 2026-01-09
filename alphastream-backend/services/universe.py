import logging
from datetime import datetime
from typing import Dict, List, Optional

from database.db_manager import db
from config import STOCK_TTL, UNIVERSE_TTL
from models import Stock
from utils.cache import TTLCache

logger = logging.getLogger(__name__)

_universe_cache = TTLCache(UNIVERSE_TTL)
_stock_cache = TTLCache(STOCK_TTL)


def _map_db_row_to_stock(data: Dict) -> Stock:
    """Convert a database row into the Stock model."""
    return Stock(
        ticker=data.get("ticker", ""),
        name=data.get("name", data.get("ticker", "")),
        sector=data.get("sector") or "Unknown",
        industry=data.get("industry") or "Unknown",
        marketCap=float(data.get("market_cap") or 0),
        price=float(data.get("price") or 0),
        change1D=float(data.get("change_1d") or 0),
        change1W=float(data.get("change_1w") or 0),
        change1M=float(data.get("change_1m") or 0),
        changeYTD=float(data.get("change_ytd") or 0),
        change1Y=float(data.get("change_1y") or 0),
        change5Y=float(data.get("change_5y") or 0),
        peRatio=data.get("pe_ratio"),
        forwardPE=None,
        pegRatio=None,
        priceToBook=None,
        evToEbitda=None,
        evToSales=None,
        dividendYield=data.get("dividend_yield"),
        beta=data.get("beta"),
        eps=data.get("eps"),
        volume=float(data.get("volume") or 0),
        avgVolume=float(data.get("volume") or 0),
        grossMargin=float(data.get("gross_margin") or 0),
        operatingMargin=0.0,
        netMargin=float(data.get("net_profit_margin") or 0),
        roe=float(data.get("roe") or 0),
        roic=0.0,
        revenueGrowth=0.0,
        earningsGrowth=0.0,
        fcfYield=0.0,
        catalysts=[],
        weight=float(data.get("weight") or 0.0),
        updatedAt=data.get("last_updated") or datetime.utcnow().isoformat(),
    )


def get_core_universe(force_refresh: bool = False) -> List[Stock]:
    cached, stale = _universe_cache.get("core")
    if cached and not force_refresh and not stale:
        return cached

    try:
        rows = db.get_all_stocks(order_by="market_cap DESC")
        stocks = [_map_db_row_to_stock(row) for row in rows]
        _universe_cache.set("core", stocks)
        return stocks
    except Exception as exc:
        logger.warning("Failed to load universe from DB: %s", exc)
        if cached:
            return cached
        raise


def search_symbol(query: str) -> List[Stock]:
    universe = get_core_universe()
    query_lower = query.lower()
    return [
        stock
        for stock in universe
        if query_lower in stock.ticker.lower() or query_lower in stock.name.lower()
    ]


def get_stock_detail(ticker: str) -> Optional[Stock]:
    cached, stale = _stock_cache.get(ticker)
    if cached and not stale:
        return cached

    universe = get_core_universe()
    for stock in universe:
        if stock.ticker == ticker:
            _stock_cache.set(ticker, stock)
            return stock
    return None
