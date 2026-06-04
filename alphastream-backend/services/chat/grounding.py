"""Resolve tickers from a chat turn and format live FMP data for grounding.

Phase 1 of FMP-in-chat: before the LLM is called, ``build_grounding_block``
detects which symbol(s) the user is asking about (from the page context and
the message text), pulls real data via the ``market_data`` accessors, and
returns a compact markdown block to inject into the system prompt.

Symbol resolution favours precision over recall so we never waste tokens (or
mislead the model) on false positives:
  * Explicit mentions — a ``$TICKER`` cashtag or the page's stock context —
    are trusted, validated against the local universe or a cheap live quote.
  * Bare uppercase tokens in free text must match the local universe and not
    be a common English/finance stop-word.
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional

from database.db_manager import db
from services.chat import market_data
from services.chat.market_data import DEFAULT_DOMAINS
from services.fmp_client import fmp_client

logger = logging.getLogger(__name__)

MAX_SYMBOLS = 3

# Context labels that are not a stock (the generic Intelligence assistant, etc.)
_GENERIC_LABELS = {"assistant", "new thread", "copilot", ""}

_CASHTAG_RE = re.compile(r"\$([A-Za-z]{1,5})\b")
_BARE_TICKER_RE = re.compile(r"\b([A-Z]{2,5})\b")
_TICKER_SHAPE_RE = re.compile(r"^[A-Z]{1,5}([.\-][A-Z]{1,2})?$")

# Common all-caps tokens that are valid tickers OR English words but are almost
# never what the user means when typed in prose. Bare-token matches in this set
# are ignored (explicit $cashtags still work).
_STOPWORDS = {
    "A", "I", "AI", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "IF", "IN", "IS",
    "IT", "ME", "MY", "NO", "OF", "ON", "OR", "SO", "TO", "UP", "US", "WE",
    "ALL", "AND", "ANY", "ARE", "BUY", "CAN", "CEO", "CFO", "CTO", "EPS", "ETF",
    "EU", "FAQ", "FED", "FOR", "GDP", "GET", "HOW", "IPO", "NOT", "NOW", "OUT",
    "PER", "ROE", "ROI", "SEC", "THE", "USA", "USD", "WHO", "WHY", "YES", "YOY",
    "Q1", "Q2", "Q3", "Q4", "UK", "PE", "EV", "TTM", "YTD",
}


def _is_known_symbol(symbol: str) -> bool:
    try:
        return db.get_stock(symbol) is not None
    except Exception:
        return False


def _has_live_quote(symbol: str) -> bool:
    try:
        return fmp_client.get_quote(symbol) is not None
    except Exception:
        return False


def resolve_symbols(
    message: str,
    context_label: Optional[str] = None,
    max_symbols: int = MAX_SYMBOLS,
) -> List[str]:
    """Return up to ``max_symbols`` tickers referenced by this turn.

    Priority: page context, then $cashtags, then validated bare tokens.
    """
    message = message or ""
    # (kind, symbol) candidates in priority order.
    candidates: list[tuple[str, str]] = []

    if context_label:
        label = context_label.strip()
        if label.lower() not in _GENERIC_LABELS:
            up = label.upper()
            if _TICKER_SHAPE_RE.match(up):
                candidates.append(("explicit", up))

    for m in _CASHTAG_RE.findall(message):
        candidates.append(("explicit", m.upper()))

    for m in _BARE_TICKER_RE.findall(message):
        candidates.append(("bare", m.upper()))

    resolved: list[str] = []
    seen: set[str] = set()
    for kind, sym in candidates:
        if sym in seen or sym in _STOPWORDS:
            continue
        if kind == "explicit":
            ok = _is_known_symbol(sym) or _has_live_quote(sym)
        else:
            ok = _is_known_symbol(sym)
        if ok:
            seen.add(sym)
            resolved.append(sym)
            if len(resolved) >= max_symbols:
                break
    return resolved


# --------------------------------------------------------------------------- #
# Formatting
# --------------------------------------------------------------------------- #

def _money(x) -> Optional[str]:
    try:
        return f"${float(x):,.2f}"
    except (TypeError, ValueError):
        return None


def _big(x) -> Optional[str]:
    try:
        n = float(x)
    except (TypeError, ValueError):
        return None
    for unit, scale in (("T", 1e12), ("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if abs(n) >= scale:
            return f"{n / scale:.2f}{unit}"
    return f"{n:.0f}"


def _pct_frac(x, dec: int = 1) -> Optional[str]:
    """Format a fraction (0.46) as a percent (46.0%)."""
    try:
        return f"{float(x) * 100:.{dec}f}%"
    except (TypeError, ValueError):
        return None


def _num(x, dec: int = 2) -> Optional[str]:
    try:
        return f"{float(x):.{dec}f}"
    except (TypeError, ValueError):
        return None


def _join(parts: list[Optional[str]], sep: str = " | ") -> str:
    return sep.join(p for p in parts if p)


def _kv(label: str, value: Optional[str]) -> Optional[str]:
    return f"{label} {value}" if value else None


def _format_symbol(data: dict) -> str:
    symbol = data.get("symbol", "")
    snap = data.get("snapshot") or {}
    fund = data.get("fundamentals") or {}
    an = data.get("analyst") or {}
    news = data.get("news") or []

    name = snap.get("name")
    header = f"{symbol} — {name}" if name else symbol
    lines: list[str] = [f"### {header}"]

    # Price line
    price = _money(snap.get("price"))
    chg = snap.get("changePercent")
    chg_str = f"({float(chg):+.2f}%)" if isinstance(chg, (int, float)) else None
    price_line = _join([
        _kv("Price", f"{price} {chg_str}".strip()) if price else None,
        _kv("Day", f"{_num(snap.get('dayLow'))}-{_num(snap.get('dayHigh'))}")
        if snap.get("dayLow") else None,
        _kv("52w", f"{_num(snap.get('yearLow'))}-{_num(snap.get('yearHigh'))}")
        if snap.get("yearLow") else None,
        _kv("50d/200d", f"{_num(snap.get('priceAvg50'))}/{_num(snap.get('priceAvg200'))}")
        if snap.get("priceAvg50") else None,
    ])
    if price_line:
        lines.append(price_line)

    # Company line
    sector_industry = _join(
        [snap.get("sector"), snap.get("industry")], sep=" / "
    )
    company_line = _join([
        _kv("Mkt cap", _big(snap.get("marketCap"))),
        sector_industry or None,
        _kv("Beta", _num(snap.get("beta"))),
        snap.get("exchange"),
    ])
    if company_line:
        lines.append(company_line)

    # Valuation
    val_line = _join([
        _kv("P/E", _num(fund.get("pe"))),
        _kv("P/S", _num(fund.get("ps"))),
        _kv("P/B", _num(fund.get("pb"))),
        _kv("EV/EBITDA", _num(fund.get("evToEbitda"))),
    ])
    if val_line:
        lines.append("Valuation: " + val_line)

    # Margins / returns
    margin_line = _join([
        _kv("gross", _pct_frac(fund.get("grossMargin"))),
        _kv("op", _pct_frac(fund.get("operatingMargin"))),
        _kv("net", _pct_frac(fund.get("netMargin"))),
        _kv("ROE", _pct_frac(fund.get("roe"))),
        _kv("ROIC", _pct_frac(fund.get("roic"))),
    ])
    if margin_line:
        lines.append("Margins/returns: " + margin_line)

    # Balance sheet
    bal_line = _join([
        _kv("D/E", _num(fund.get("debtToEquity"))),
        _kv("current", _num(fund.get("currentRatio"))),
        _kv("net debt/EBITDA", _num(fund.get("netDebtToEbitda"))),
        _kv("FCF yield", _pct_frac(fund.get("fcfYield"))),
    ])
    if bal_line:
        lines.append("Balance: " + bal_line)

    # Analyst
    grade_counts = _join([
        _kv("SB", _num(an.get("strongBuy"), 0)),
        _kv("B", _num(an.get("buy"), 0)),
        _kv("H", _num(an.get("hold"), 0)),
        _kv("S", _num(an.get("sell"), 0)),
        _kv("SS", _num(an.get("strongSell"), 0)),
    ], sep="/")
    est = _join([
        _kv("EPS", _num(an.get("epsAvg"))),
        _kv("rev", _big(an.get("revenueAvg"))),
    ], sep=", ")
    analyst_line = _join([
        _kv("consensus", an.get("consensus")),
        f"({grade_counts})" if grade_counts else None,
        _kv("avg target", _money(an.get("targetAvg"))),
        _kv("FY est", est) if est else None,
    ])
    if analyst_line:
        lines.append("Analyst: " + analyst_line)

    # News
    if news:
        lines.append("Recent news:")
        for item in news:
            date = item.get("date") or ""
            pub = item.get("publisher")
            title = item.get("title")
            suffix = f" ({pub})" if pub else ""
            lines.append(f" - {date} — {title}{suffix}")

    return "\n".join(lines)


def build_grounding_block(
    message: str,
    context_label: Optional[str] = None,
    domains: tuple[str, ...] = DEFAULT_DOMAINS,
) -> str:
    """Resolve symbols for this turn and return a formatted live-data block.

    Returns an empty string when no symbol is confidently identified or no
    data could be fetched. Synchronous (FMP calls block) — run in an executor
    from the async chat path.
    """
    symbols = resolve_symbols(message, context_label)
    if not symbols:
        return ""

    blocks: list[str] = []
    for sym in symbols:
        data = market_data.gather_symbol_data(sym, domains)
        # Only include if at least one domain returned something.
        if any(k != "symbol" for k in data):
            blocks.append(_format_symbol(data))

    if not blocks:
        return ""

    logger.info("[GROUNDING] Injected live data for: %s", ", ".join(symbols))
    return (
        "=== LIVE MARKET DATA (Financial Modeling Prep) ===\n"
        "Real, current data retrieved for this conversation. Treat these "
        "figures as authoritative and cite specifics when relevant. Margins, "
        "ROE/ROIC and FCF yield are shown as percentages; fundamentals are "
        "latest fiscal year.\n\n"
        + "\n\n".join(blocks)
        + "\n=== END LIVE MARKET DATA ==="
    )
