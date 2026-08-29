"""Gemini-powered "interesting upcoming earnings" summary with in-memory cache.

Mirrors services/market_summary_generator.py but focuses on the most notable,
potentially market-moving companies reporting over the next ~10 trading days.
"""

from __future__ import annotations

import json
import logging
import re
import threading
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pytz

from config import GEMINI_API_KEY, GEMINI_MODEL
from database.db_manager import db
from services.fmp_client import fmp_client

logger = logging.getLogger(__name__)

ET_TZ = pytz.timezone("US/Eastern")

# Calendar window that comfortably covers the next ~10 trading days.
LOOKAHEAD_CALENDAR_DAYS = 16
# Max earnings rows fed to Gemini (keeps the prompt bounded).
MAX_CONTEXT_ROWS = 90
# Regenerate the cached summary when it is older than this.
EARNINGS_SUMMARY_TTL_HOURS = 12

EARNINGS_SUMMARY_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "openingSummary": {"type": "string"},
        "spotlights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "company": {"type": "string"},
                    "date": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["symbol", "company", "date", "why"],
            },
        },
    },
    "required": ["openingSummary", "spotlights"],
}

# In-memory cache: latest summary + metadata
_cache: Dict[str, Any] = {
    "summary": None,
    "generated_at": None,
}
_last_generation_error: Optional[str] = None
# Serialize generation so a burst of requests triggers at most one Gemini call.
_gen_lock = threading.Lock()
# After a failed generation (e.g. Gemini 503), skip retries for this long so
# each page load does not pay a 15-40s doomed API call during an outage.
_FAILURE_BACKOFF_SECONDS = 120
_last_failed_attempt: Optional[float] = None


def _format_meta_timestamps(generated_at: datetime) -> Dict[str, str]:
    et = generated_at.astimezone(ET_TZ) if generated_at.tzinfo else ET_TZ.localize(generated_at)
    return {
        "date": et.strftime("%A, %B %d"),
        "updated": f"Updated {et.strftime('%H:%M')} ET",
    }


def _is_stale() -> bool:
    generated_at: Optional[datetime] = _cache.get("generated_at")
    if _cache.get("summary") is None or generated_at is None:
        return True
    threshold = datetime.now(ET_TZ) - timedelta(hours=EARNINGS_SUMMARY_TTL_HOURS)
    return generated_at < threshold


def gather_earnings_context() -> Dict[str, Any]:
    """Collect upcoming earnings for the next ~10 trading days with company names."""
    today = datetime.now(ET_TZ).date()
    from_date = today.strftime("%Y-%m-%d")
    to_date = (today + timedelta(days=LOOKAHEAD_CALENDAR_DAYS)).strftime("%Y-%m-%d")

    try:
        raw = fmp_client.get_earnings_calendar_range(from_date, to_date) or []
    except Exception as exc:
        logger.warning("[EARNINGS_SUMMARY] earnings calendar unavailable: %s", exc)
        raw = []

    try:
        name_map = db.get_ticker_name_map() or {}
    except Exception as exc:
        logger.warning("[EARNINGS_SUMMARY] stock names unavailable: %s", exc)
        name_map = {}

    rows: List[Dict[str, Any]] = []
    for e in raw:
        ticker = (e.get("symbol") or "").upper()
        if not ticker:
            continue
        rows.append({
            "symbol": ticker,
            "company": name_map.get(ticker) or ticker,
            "date": e.get("date"),
            "eps_estimated": e.get("epsEstimated"),
            "revenue_estimated": e.get("revenueEstimated"),
        })

    # Prioritize names we recognize (in our universe) and those with estimates,
    # so the model has the most relevant, well-known candidates first.
    rows.sort(
        key=lambda r: (
            0 if r["symbol"] in name_map else 1,
            0 if r.get("eps_estimated") is not None else 1,
            r.get("date") or "",
        )
    )

    return {
        "range_start": from_date,
        "range_end": to_date,
        "count": len(rows),
        "earnings": rows[:MAX_CONTEXT_ROWS],
    }


def build_earnings_prompt(context: Dict[str, Any]) -> str:
    data_block = json.dumps(context, indent=2, default=str)
    return f"""Act as an equity analyst writing a concise preview of the most interesting corporate earnings coming up over roughly the next 10 trading days for a U.S. markets audience. Use clear, everyday language and define complex terms inline.

Using ONLY the companies in the AlphaStream earnings data below as your candidate set, do the following:

1. Write a 2-3 sentence "openingSummary" that sets the scene for the upcoming earnings stretch: which themes, sectors, or megacap names dominate, and what investors should watch for. Keep it flowing, not a list.

2. Select the 10 MOST notable / potentially market-moving companies reporting in this window and return them as "spotlights" (return up to 10; fewer only if the data has fewer credible names). Favor widely-followed large caps, bellwethers, and names whose results tend to move the broader market or their sector. For each spotlight provide:
   - "symbol": the ticker exactly as given in the data
   - "company": the company name
   - "date": the report date exactly as given (YYYY-MM-DD)
   - "why": one or two sentences on why this report matters and what to watch (guidance, a key segment, sector read-through, etc.)

Do not invent tickers, companies, or dates that are not present in the data. If estimates are provided you may reference them, but do not fabricate figures.

AlphaStream upcoming earnings data:
{data_block}

Answer in JSON with this exact structure:
{{
  "openingSummary": "...",
  "spotlights": [
    {{ "symbol": "...", "company": "...", "date": "YYYY-MM-DD", "why": "..." }}
  ]
}}"""


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


def call_gemini(prompt: str) -> Dict[str, Any]:
    """Request a structured JSON earnings summary from Gemini."""
    from google.genai import types

    client = _get_gemini_client()
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=EARNINGS_SUMMARY_JSON_SCHEMA,
                temperature=0.4,
            ),
        )
    except Exception as exc:
        raise RuntimeError(
            f"Gemini API call failed (model={GEMINI_MODEL}): {exc}"
        ) from exc

    if hasattr(response, "parsed") and isinstance(response.parsed, dict):
        return response.parsed

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise RuntimeError(
            f"Gemini returned no text (model={GEMINI_MODEL}). "
            "Check API key, model name, and quota."
        )
    return _parse_json_response(text)


def normalize_summary_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    opening = (raw.get("openingSummary") or raw.get("opening_summary") or "").strip()
    if not opening:
        raise ValueError("Missing openingSummary")

    spotlights_out: List[Dict[str, str]] = []
    for item in raw.get("spotlights") or []:
        if not isinstance(item, dict):
            continue
        symbol = (item.get("symbol") or "").strip().upper()
        company = (item.get("company") or "").strip()
        date = (item.get("date") or "").strip()
        why = (item.get("why") or "").strip()
        if symbol and why:
            spotlights_out.append({
                "symbol": symbol,
                "company": company or symbol,
                "date": date,
                "why": why,
            })

    if not spotlights_out:
        raise ValueError("No valid spotlights in Gemini response")

    return {"openingSummary": opening, "spotlights": spotlights_out[:10]}


def get_last_generation_error() -> Optional[str]:
    return _last_generation_error


def generate_earnings_summary(force: bool = False) -> bool:
    """Generate and cache a new earnings summary. Returns True on success."""
    global _last_generation_error, _last_failed_attempt

    if not GEMINI_API_KEY:
        _last_generation_error = "GEMINI_API_KEY is not set in backend .env"
        logger.warning("[EARNINGS_SUMMARY] GEMINI_API_KEY not set; skipping generation")
        return False

    # One generation at a time; if another thread just refreshed and we are not
    # forcing, reuse its result.
    with _gen_lock:
        if not force and not _is_stale():
            return True
        if (
            not force
            and _last_failed_attempt is not None
            and (datetime.now(ET_TZ).timestamp() - _last_failed_attempt) < _FAILURE_BACKOFF_SECONDS
        ):
            return False
        try:
            context = gather_earnings_context()
            if not context.get("earnings"):
                _last_generation_error = "No upcoming earnings available to summarize"
                logger.warning("[EARNINGS_SUMMARY] No earnings rows; skipping generation")
                return False
            prompt = build_earnings_prompt(context)
            logger.info("[EARNINGS_SUMMARY] Calling Gemini model=%s", GEMINI_MODEL)
            raw = call_gemini(prompt)
            summary = normalize_summary_payload(raw)
            summary["range"] = {
                "start": context.get("range_start"),
                "end": context.get("range_end"),
            }
            _cache["summary"] = summary
            _cache["generated_at"] = datetime.now(ET_TZ)
            _last_generation_error = None
            _last_failed_attempt = None
            logger.info("[EARNINGS_SUMMARY] Generated new summary")
            return True
        except Exception as exc:
            _last_generation_error = str(exc)
            _last_failed_attempt = datetime.now(ET_TZ).timestamp()
            logger.exception("[EARNINGS_SUMMARY] Generation failed: %s", exc)
            return False


def get_earnings_summary_response() -> Dict[str, Any]:
    """Return latest cached summary (never calls Gemini)."""
    summary = _cache.get("summary")
    generated_at: Optional[datetime] = _cache.get("generated_at")

    if summary is None:
        return {
            "openingSummary": None,
            "spotlights": [],
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
    return {
        **summary,
        "meta": meta,
        "generated_at": generated_at.isoformat() if generated_at else None,
        "available": True,
    }


def get_or_generate_earnings_summary() -> Dict[str, Any]:
    """Return the cached summary, generating it first if empty or stale."""
    if _is_stale() and GEMINI_API_KEY:
        generate_earnings_summary()
    return get_earnings_summary_response()
