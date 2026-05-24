"""Gemini-powered market summary generation with in-memory cache."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pytz

from config import GEMINI_API_KEY, GEMINI_MODEL
from database.db_manager import db
from services.sector_importer import get_sector_performance_summary

logger = logging.getLogger(__name__)

ET_TZ = pytz.timezone("US/Eastern")


def _is_market_hours() -> bool:
    """Reuse shared market-hours helper (lazy import avoids circular deps)."""
    from services.refresh_scheduler import is_market_hours

    return is_market_hours()

EXPECTED_SECTION_TITLES = [
    "Market Drivers",
    "Key Corporate & Earnings Moves",
    "International News",
    "Looking Ahead",
]

MARKET_SUMMARY_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "openingSummary": {"type": "string"},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "text": {"type": "string"},
                            },
                            "required": ["label", "text"],
                        },
                    },
                },
                "required": ["title", "items"],
            },
        },
    },
    "required": ["openingSummary", "sections"],
}

# In-memory cache: latest summary + metadata
_cache: Dict[str, Any] = {
    "summary": None,
    "generated_at": None,
}
_last_generation_error: Optional[str] = None


def _format_date_label(now_et: datetime, market_open: bool) -> str:
    base = now_et.strftime("%A, %B %d, %Y")
    if market_open:
        return base
    return f"{base} (last close)"


def _format_meta_timestamps(generated_at: datetime) -> Dict[str, str]:
    et = generated_at.astimezone(ET_TZ) if generated_at.tzinfo else ET_TZ.localize(generated_at)
    return {
        "date": et.strftime("%A, %B %d"),
        "updated": f"Updated {et.strftime('%H:%M')} ET",
    }


def gather_market_context() -> Dict[str, Any]:
    """Assemble market data from existing DB/services for the Gemini prompt."""
    try:
        indices = db.get_all_indices() or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] indices unavailable: %s", exc)
        indices = []
    try:
        sectors = get_sector_performance_summary() or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] sectors unavailable: %s", exc)
        sectors = []
    try:
        gainers = db.get_market_movers(category="gainer")[:8]
        losers = db.get_market_movers(category="loser")[:8]
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] movers unavailable: %s", exc)
        gainers, losers = [], []
    try:
        news = db.get_news_general(limit=15) or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] news unavailable: %s", exc)
        news = []
    try:
        macro = db.get_all_indicators() or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] macro unavailable: %s", exc)
        macro = []
    try:
        alt_assets = db.get_all_alternative_assets() or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] alt assets unavailable: %s", exc)
        alt_assets = []

    today = datetime.now(ET_TZ).date()
    try:
        earnings = db.get_earnings_calendar(
            from_date=today.strftime("%Y-%m-%d"),
            to_date=(today + timedelta(days=2)).strftime("%Y-%m-%d"),
        ) or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] earnings unavailable: %s", exc)
        earnings = []

    try:
        treasury = db.get_treasury_history(days=3) or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] treasury unavailable: %s", exc)
        treasury = []
    try:
        vix = db.get_vix_history(days=3) or []
    except Exception as exc:
        logger.warning("[MARKET_SUMMARY] vix unavailable: %s", exc)
        vix = []

    def _index_row(*symbols: str) -> Optional[dict]:
        by_sym = {i.get("symbol"): i for i in indices if i.get("symbol")}
        for sym in symbols:
            if sym in by_sym:
                return by_sym[sym]
        return None

    return {
        "indices": {
            "SPX": _index_row("^GSPC", "SPX"),
            "NDX": _index_row("^IXIC", "NDX"),
            "DJI": _index_row("^DJI", "DJI"),
            "RUT": _index_row("^RUT", "RUT"),
            "VIX": _index_row("^VIX", "VIX"),
        },
        "sectors": sorted(sectors, key=lambda s: s.get("change1D", 0), reverse=True)[:11],
        "gainers": gainers,
        "losers": losers,
        "news": [
            {
                "title": n.get("title"),
                "snippet": (n.get("snippet") or "")[:300],
                "site": n.get("site"),
                "published_date": n.get("published_date"),
            }
            for n in news[:12]
        ],
        "macro_indicators": macro[:12],
        "alternative_assets": alt_assets[:8],
        "earnings": earnings[:20],
        "treasury": treasury[-3:] if treasury else [],
        "vix_history": vix[-3:] if vix else [],
    }


def _context_to_prompt_block(context: Dict[str, Any]) -> str:
    """Serialize gathered context for inclusion in the user prompt."""
    return json.dumps(context, indent=2, default=str)


def build_analyst_prompt(date_label: str, context: Dict[str, Any]) -> str:
    """Exact analyst instructions from MarketSummaryPrompt.ipynb."""
    data_block = _context_to_prompt_block(context)
    return f"""Act as a financial analyst and peer. Provide a concise, clear, and highly scannable daily recap of the U.S. stock market for {date_label}. Use everyday language and define any complex terms inline. Do not use dense walls of text.

Structure the response exactly as follows:

1. A brief, 4-sentenced opening summary of the day's overarching narrative and market tone. A finishing sentence of the index which led the day, the increased compared to the other, for example: The small-cap Russell 2000 index led the day's gainers, surging 2.4%, while the large-cap indexes closed up over 1% across the board.
2. A section titled "## What Drove the Markets Today?" using 5 bullet points to break down the top macroeconomic catalysts (e.g., tech earnings, inflation data, Fed speakers, geopolitics). Maximum two sentences per bullet point.

3. A section titled "## Key Corporate & Earnings Moves" using 5 bullet points to highlight the specific companies, stocks, or sectors that made the biggest individual moves, explaining the 'why' behind the action. Maximum two sentences per bullet point.
4. A section titled "##International News" using 5 bullets consisting of two sentences that explains the most noteworthy news in the financial markets
5. A section titled "##Looking Ahead" using 5 bullet consiting of max two sentences that explains important things that is happening and what you should know moving foward.

Use the following AlphaStream market data as factual grounding. Do not invent tickers or figures not supported by this data; you may infer narrative tone from the numbers.

{data_block}

Answer in JSON format with this exact structure (section titles must match exactly):
{{
  "openingSummary": "...",
  "sections": [
    {{
      "title": "Market Drivers",
      "items": [
        {{ "label": "...", "text": "..." }}
      ]
    }},
    {{
      "title": "Key Corporate & Earnings Moves",
      "items": [
        {{ "label": "...", "text": "..." }}
      ]
    }},
    {{
      "title": "International News",
      "items": [
        {{ "label": "...", "text": "..." }}
      ]
    }},
    {{
      "title": "Looking Ahead",
      "items": [
        {{ "label": "...", "text": "..." }}
      ]
    }}
  ]
}}

Each section must have exactly 5 items. Labels should end with a colon when appropriate (e.g. "Treasury Yields:")."""


def _normalize_section_title(title: str) -> str:
    t = (title or "").strip()
    aliases = {
        "what drove the markets today?": "Market Drivers",
        "what drove the markets today": "Market Drivers",
        "market drivers": "Market Drivers",
        "key corporate & earnings moves": "Key Corporate & Earnings Moves",
        "international news": "International News",
        "##international news": "International News",
        "looking ahead": "Looking Ahead",
        "##looking ahead": "Looking Ahead",
    }
    key = t.lower().lstrip("#").strip()
    return aliases.get(key, t)


def normalize_summary_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and normalize Gemini JSON to frontend shape."""
    opening = (raw.get("openingSummary") or raw.get("opening_summary") or "").strip()
    if not opening:
        raise ValueError("Missing openingSummary")

    sections_in = raw.get("sections") or []
    by_title: Dict[str, List[Dict[str, str]]] = {}

    for section in sections_in:
        if not isinstance(section, dict):
            continue
        title = _normalize_section_title(section.get("title", ""))
        items = []
        for item in section.get("items") or []:
            if not isinstance(item, dict):
                continue
            label = (item.get("label") or "").strip()
            text = (item.get("text") or "").strip()
            if label and text:
                items.append({"label": label, "text": text})
        if title and items:
            by_title[title] = items

    sections_out = []
    for expected_title in EXPECTED_SECTION_TITLES:
        items = by_title.get(expected_title, [])
        if not items:
            continue
        sections_out.append({"title": expected_title, "items": items[:5]})

    if len(sections_out) < 4:
        logger.warning(
            "[MARKET_SUMMARY] Expected 4 sections, got %s — using partial result",
            len(sections_out),
        )
    if not sections_out:
        raise ValueError("No valid sections in Gemini response")

    return {"openingSummary": opening, "sections": sections_out}


def _parse_json_response(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def _get_gemini_client():
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    try:
        from google import genai
    except ImportError as exc:
        raise RuntimeError(
            "google-genai is not installed. Run: pip install google-genai"
        ) from exc

    return genai.Client(api_key=GEMINI_API_KEY)


def test_gemini_connection() -> str:
    """
    Minimal Gemini ping (matches official quickstart).
    Returns model response text or raises with a clear error.
    """
    client = _get_gemini_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents="Reply with exactly: OK",
    )
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise RuntimeError("Gemini returned empty text")
    return text


def call_gemini(prompt: str) -> Dict[str, Any]:
    """Request structured JSON market summary from Gemini."""
    from google.genai import types

    client = _get_gemini_client()
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=MARKET_SUMMARY_JSON_SCHEMA,
                temperature=0.4,
            ),
        )
    except Exception as exc:
        raise RuntimeError(
            f"Gemini API call failed (model={GEMINI_MODEL}): {exc}"
        ) from exc

    if hasattr(response, "parsed") and response.parsed:
        if isinstance(response.parsed, dict):
            return response.parsed

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise RuntimeError(
            f"Gemini returned no text (model={GEMINI_MODEL}). "
            "Check API key, model name, and quota."
        )
    return _parse_json_response(text)


def get_last_generation_error() -> Optional[str]:
    return _last_generation_error


def generate_market_summary(force: bool = False) -> bool:
    """
    Generate and cache a new market summary.
    Returns True on success, False on failure (previous cache retained).
    """
    global _last_generation_error

    if not GEMINI_API_KEY:
        _last_generation_error = "GEMINI_API_KEY is not set in backend .env"
        logger.warning("[MARKET_SUMMARY] GEMINI_API_KEY not set; skipping generation")
        return False

    now_et = datetime.now(ET_TZ)
    date_label = _format_date_label(now_et, _is_market_hours())

    try:
        context = gather_market_context()
        prompt = build_analyst_prompt(date_label, context)
        logger.info("[MARKET_SUMMARY] Calling Gemini model=%s", GEMINI_MODEL)
        raw = call_gemini(prompt)
        summary = normalize_summary_payload(raw)
        generated_at = datetime.now(ET_TZ)
        _cache["summary"] = summary
        _cache["generated_at"] = generated_at
        _last_generation_error = None
        logger.info("[MARKET_SUMMARY] Generated new summary at %s", generated_at.isoformat())
        return True
    except Exception as exc:
        _last_generation_error = str(exc)
        logger.exception("[MARKET_SUMMARY] Generation failed: %s", exc)
        return False


def market_summary_job() -> None:
    """Scheduled job: generate only during market hours."""
    if not _is_market_hours():
        logger.info("[MARKET_SUMMARY] Skipping hourly job — market is closed")
        return
    generate_market_summary()


def maybe_generate_on_startup() -> None:
    """If market is open and cache is empty, generate once in background."""
    if not _is_market_hours():
        logger.info("[MARKET_SUMMARY] Startup skip — outside market hours")
        return
    if _cache.get("summary") is not None:
        return
    if not GEMINI_API_KEY:
        logger.warning("[MARKET_SUMMARY] Startup skip — GEMINI_API_KEY not set")
        return
    logger.info("[MARKET_SUMMARY] Startup generation (market hours, empty cache)")
    generate_market_summary()


def get_market_summary_response() -> Dict[str, Any]:
    """Return latest summary for API (never calls Gemini)."""
    summary = _cache.get("summary")
    generated_at: Optional[datetime] = _cache.get("generated_at")

    if summary is None:
        return {
            "openingSummary": None,
            "sections": [],
            "meta": {
                "date": datetime.now(ET_TZ).strftime("%A, %B %d"),
                "updated": "Not yet generated",
            },
            "generated_at": None,
            "available": False,
        }

    meta = _format_meta_timestamps(generated_at) if generated_at else {
        "date": datetime.now(ET_TZ).strftime("%A, %B %d"),
        "updated": "Unknown",
    }
    gen_iso = generated_at.isoformat() if generated_at else None

    return {
        **summary,
        "meta": meta,
        "generated_at": gen_iso,
        "available": True,
    }
