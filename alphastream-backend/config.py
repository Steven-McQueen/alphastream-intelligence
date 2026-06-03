import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
# Load .env file explicitly from backend directory
dotenv_path = BASE_DIR / '.env'
load_dotenv(dotenv_path=dotenv_path)

# API keys
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
# Google Gemini — Market Summary generation (server-side only)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Chat LLM providers (server-side only; never exposed to frontend)
# Accept common alternate env names used in local .env files
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("CHATGPT_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
# Moonshot (Kimi) — OpenAI-compatible API. Tolerate the misspelled env name
# that ships in some local .env files (MOONSHOOT_API_KEY).
MOONSHOT_API_KEY = (
    os.getenv("MOONSHOT_API_KEY")
    or os.getenv("MOONSHOOT_API_KEY")
    or os.getenv("KIMI_API_KEY", "")
)
# Base URL for Moonshot's OpenAI-compatible endpoint. Use the .cn host for
# China-region keys; defaults to the international (.ai) host.
MOONSHOT_BASE_URL = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.ai/v1")
# DeepSeek — OpenAI-compatible API.
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEEP_SEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# ============================================================================
# SUPABASE AUTH (JWT validation for user-scoped endpoints)
# ============================================================================
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# ============================================================================
# DATABASE CONFIGURATION (Supabase PostgreSQL)
# ============================================================================
# Connection string format: postgresql://user:password@host:port/database
DATABASE_URL = os.getenv("DATABASE_URL", "")
# Use SQLite fallback for local development if DATABASE_URL not set
USE_SQLITE_FALLBACK = os.getenv("USE_SQLITE_FALLBACK", "false").lower() == "true"

# Interactive Brokers (future)
IB_HOST = os.getenv("IB_HOST", "127.0.0.1")
IB_PORT = int(os.getenv("IB_PORT", "7497"))
IB_CLIENT_ID = int(os.getenv("IB_CLIENT_ID", "1"))

# Cache TTLs (seconds)
UNIVERSE_TTL = 3600  # 1 hour
STOCK_TTL = 300      # 5 minutes
MARKET_TTL = 600     # 10 minutes
NEWS_TTL = 1800      # 30 minutes
NEWSAPI_REFRESH_MINUTES = int(os.getenv("NEWSAPI_REFRESH_MINUTES", "120"))

# Rate limiting
FINNHUB_RATE_LIMIT = 60  # calls per minute (free tier)

# ============================================================================
# FMP (Financial Modeling Prep) CONFIGURATION
# ============================================================================
FMP_API_KEY = os.getenv("FMP_API_KEY", "")
# Batch size for optimized quote requests (max ~500, but URL length limits apply)
# 200 is conservative: 200 symbols × ~5 chars = 1000 chars, leaving room for URL base
FMP_BATCH_SIZE = int(os.getenv("FMP_BATCH_SIZE", "200"))
FMP_BATCH_SIZE_MIN = 50  # Minimum before giving up on batch

# Fallback data
FALLBACK_FILE = DATA_DIR / "sp500_fallback.json"

# ============================================================================
# MACRO DATA CONFIGURATION
# ============================================================================
# Cache TTL
CACHE_TTL_MACRO = 300  # 5 minutes for current values