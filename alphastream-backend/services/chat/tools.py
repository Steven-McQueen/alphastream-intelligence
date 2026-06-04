"""Provider-neutral tool registry for the agentic copilot.

Each ``ToolSpec`` pairs a JSON-Schema description (what the LLM sees) with a
Python handler (what the backend runs). The registry is the seam the three
provider agent loops share, and the place a future FMP MCP source plugs into:
an MCP client would just register additional ToolSpecs here, and every
provider adapter would pick them up unchanged.

Exporters convert specs into each provider's native tool shape:
  * OpenAI / Moonshot / DeepSeek -> ``to_openai_tools``
  * Anthropic                    -> ``to_anthropic_tools``
  * Gemini                       -> ``to_gemini_declarations``
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional

from services.chat import market_data
from services.fmp_client import fmp_client

logger = logging.getLogger(__name__)

# Cap on the JSON size of a single tool result fed back to the model, so one
# verbose call can't blow the context window.
_MAX_RESULT_CHARS = 6000


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema object
    handler: Callable[..., Any]


def _string(desc: str) -> Dict[str, Any]:
    return {"type": "string", "description": desc}


# --------------------------------------------------------------------------- #
# Handlers (thin wrappers over the FMP data layer)
# --------------------------------------------------------------------------- #

def _h_snapshot(symbol: str) -> Any:
    return market_data.company_snapshot(symbol.upper())


def _h_fundamentals(symbol: str) -> Any:
    return market_data.fundamentals(symbol.upper())


def _h_analyst(symbol: str) -> Any:
    return market_data.analyst_view(symbol.upper())


def _h_news(symbol: str, limit: int = 3) -> Any:
    return market_data.recent_news(symbol.upper(), limit=min(int(limit or 3), 10))


def _h_peers(symbol: str) -> Any:
    return {"symbol": symbol.upper(), "peers": fmp_client.get_stock_peers(symbol.upper())}


def _h_search(query: str) -> Any:
    return {"query": query, "matches": fmp_client.search_symbol(query)}


_STATEMENT_METHODS = {
    "income": fmp_client.get_income_statement,
    "balance": fmp_client.get_balance_sheet,
    "cash_flow": fmp_client.get_cash_flow_statement,
}


def _h_statement(
    symbol: str,
    statement: str = "income",
    period: str = "annual",
    limit: int = 2,
) -> Any:
    method = _STATEMENT_METHODS.get(statement)
    if method is None:
        return {"error": f"unknown statement '{statement}'"}
    period = "quarter" if str(period).lower().startswith("q") else "annual"
    return method(symbol.upper(), period=period, limit=min(int(limit or 2), 5))


def _h_dividends(symbol: str) -> Any:
    return {"symbol": symbol.upper(), "dividends": fmp_client.get_dividends(symbol.upper())}


def _h_technical(
    symbol: str,
    indicator: str = "rsi",
    period_length: int = 14,
    timeframe: str = "1day",
) -> Any:
    return {
        "symbol": symbol.upper(),
        "indicator": indicator,
        "period_length": int(period_length or 14),
        "latest": fmp_client.get_technical_indicator(
            symbol.upper(), indicator, int(period_length or 14), timeframe, limit=1
        ),
    }


def _h_insider(symbol: str) -> Any:
    return {"symbol": symbol.upper(), "trades": fmp_client.get_insider_trades(symbol.upper())}


def _h_executives(symbol: str) -> Any:
    return {"symbol": symbol.upper(), "executives": fmp_client.get_key_executives(symbol.upper())}


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #

_SPECS: List[ToolSpec] = [
    ToolSpec(
        name="search_symbol",
        description=(
            "Resolve a company name or partial ticker to a stock symbol. Use "
            "this first when the user names a company but not its ticker."
        ),
        parameters={
            "type": "object",
            "properties": {"query": _string("Company name or partial ticker, e.g. 'Apple'")},
            "required": ["query"],
        },
        handler=_h_search,
    ),
    ToolSpec(
        name="get_company_snapshot",
        description=(
            "Live quote and company profile for a ticker: price, day/52-week "
            "range, moving averages, market cap, sector/industry, beta, CEO, "
            "employees, description."
        ),
        parameters={
            "type": "object",
            "properties": {"symbol": _string("Stock ticker, e.g. 'AAPL'")},
            "required": ["symbol"],
        },
        handler=_h_snapshot,
    ),
    ToolSpec(
        name="get_fundamentals",
        description=(
            "Latest fiscal-year valuation, margins and returns for a ticker: "
            "P/E, P/S, P/B, EV/EBITDA, gross/operating/net margin, ROE, ROIC, "
            "FCF yield, debt/equity, current ratio."
        ),
        parameters={
            "type": "object",
            "properties": {"symbol": _string("Stock ticker, e.g. 'AAPL'")},
            "required": ["symbol"],
        },
        handler=_h_fundamentals,
    ),
    ToolSpec(
        name="get_analyst_view",
        description=(
            "Analyst rating consensus (strong buy/buy/hold/sell counts), price "
            "target summary, and the latest forward EPS/revenue estimate."
        ),
        parameters={
            "type": "object",
            "properties": {"symbol": _string("Stock ticker, e.g. 'AAPL'")},
            "required": ["symbol"],
        },
        handler=_h_analyst,
    ),
    ToolSpec(
        name="get_recent_news",
        description="Most recent company-specific news headlines for a ticker.",
        parameters={
            "type": "object",
            "properties": {
                "symbol": _string("Stock ticker, e.g. 'AAPL'"),
                "limit": {
                    "type": "integer",
                    "description": "How many headlines (1-10, default 3)",
                },
            },
            "required": ["symbol"],
        },
        handler=_h_news,
    ),
    ToolSpec(
        name="get_peers",
        description="Comparable/peer companies for a ticker (similar companies).",
        parameters={
            "type": "object",
            "properties": {"symbol": _string("Stock ticker, e.g. 'AAPL'")},
            "required": ["symbol"],
        },
        handler=_h_peers,
    ),
    ToolSpec(
        name="get_financial_statement",
        description=(
            "Reported financial statement figures for a ticker. Use for "
            "specific line items (revenue, net income, assets, cash flow)."
        ),
        parameters={
            "type": "object",
            "properties": {
                "symbol": _string("Stock ticker, e.g. 'AAPL'"),
                "statement": {
                    "type": "string",
                    "enum": ["income", "balance", "cash_flow"],
                    "description": "Which statement (default income)",
                },
                "period": {
                    "type": "string",
                    "enum": ["annual", "quarter"],
                    "description": "Reporting period (default annual)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of periods (1-5, default 2)",
                },
            },
            "required": ["symbol"],
        },
        handler=_h_statement,
    ),
    ToolSpec(
        name="get_dividends",
        description="Dividend history for a ticker (dates, amounts, yield).",
        parameters={
            "type": "object",
            "properties": {"symbol": _string("Stock ticker, e.g. 'AAPL'")},
            "required": ["symbol"],
        },
        handler=_h_dividends,
    ),
    ToolSpec(
        name="get_technical_indicator",
        description=(
            "Latest value of a technical indicator for a ticker (momentum/"
            "trend). Use for RSI, moving averages, ADX, etc."
        ),
        parameters={
            "type": "object",
            "properties": {
                "symbol": _string("Stock ticker, e.g. 'AAPL'"),
                "indicator": {
                    "type": "string",
                    "enum": ["rsi", "sma", "ema", "wma", "dema", "tema", "adx", "standardDeviation"],
                    "description": "Indicator (default rsi)",
                },
                "period_length": {"type": "integer", "description": "Look-back period (default 14)"},
                "timeframe": {
                    "type": "string",
                    "enum": ["1min", "5min", "15min", "30min", "1hour", "4hour", "1day"],
                    "description": "Bar timeframe (default 1day)",
                },
            },
            "required": ["symbol"],
        },
        handler=_h_technical,
    ),
    ToolSpec(
        name="get_insider_trades",
        description="Recent insider (Form 4) buy/sell transactions for a ticker.",
        parameters={
            "type": "object",
            "properties": {"symbol": _string("Stock ticker, e.g. 'AAPL'")},
            "required": ["symbol"],
        },
        handler=_h_insider,
    ),
    ToolSpec(
        name="get_key_executives",
        description="Company leadership / key executives (name, title, pay).",
        parameters={
            "type": "object",
            "properties": {"symbol": _string("Stock ticker, e.g. 'AAPL'")},
            "required": ["symbol"],
        },
        handler=_h_executives,
    ),
]

_REGISTRY: Dict[str, ToolSpec] = {spec.name: spec for spec in _SPECS}


def get_specs(names: Optional[Iterable[str]] = None) -> List[ToolSpec]:
    """All tool specs, or just the named subset (preserving registry order)."""
    if names is None:
        return list(_SPECS)
    wanted = set(names)
    return [s for s in _SPECS if s.name in wanted]


def has_tools(names: Optional[Iterable[str]] = None) -> bool:
    if names is None:
        return bool(_REGISTRY)
    return any(n in _REGISTRY for n in names)


def execute_tool(name: str, arguments: Dict[str, Any]) -> str:
    """Run a tool by name and return a JSON string result (never raises)."""
    spec = _REGISTRY.get(name)
    if spec is None:
        return json.dumps({"error": f"unknown tool '{name}'"})
    try:
        args = arguments if isinstance(arguments, dict) else {}
        result = spec.handler(**args)
        if result is None:
            result = {"result": None, "note": "no data found"}
        payload = json.dumps(result, default=str)
        if len(payload) > _MAX_RESULT_CHARS:
            # Keep the result valid JSON even when clipped.
            payload = json.dumps(
                {"truncated": True, "preview": payload[:_MAX_RESULT_CHARS]}
            )
        return payload
    except TypeError as exc:
        logger.warning("[TOOLS] bad arguments for %s: %s", name, exc)
        return json.dumps({"error": f"invalid arguments for {name}: {exc}"})
    except Exception as exc:
        logger.warning("[TOOLS] %s failed: %s", name, exc)
        return json.dumps({"error": f"{name} failed: {exc}"})


# --------------------------------------------------------------------------- #
# Per-provider exporters
# --------------------------------------------------------------------------- #

def to_openai_tools(names: Optional[Iterable[str]] = None) -> List[Dict[str, Any]]:
    """OpenAI / Moonshot / DeepSeek function-tool format."""
    return [
        {
            "type": "function",
            "function": {
                "name": s.name,
                "description": s.description,
                "parameters": s.parameters,
            },
        }
        for s in get_specs(names)
    ]


def to_anthropic_tools(names: Optional[Iterable[str]] = None) -> List[Dict[str, Any]]:
    """Anthropic tool format (input_schema instead of parameters)."""
    return [
        {"name": s.name, "description": s.description, "input_schema": s.parameters}
        for s in get_specs(names)
    ]


def to_gemini_declarations(names: Optional[Iterable[str]] = None) -> List[Dict[str, Any]]:
    """Gemini function-declaration dicts (OpenAPI-subset schema)."""
    return [
        {"name": s.name, "description": s.description, "parameters": s.parameters}
        for s in get_specs(names)
    ]
