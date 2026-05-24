-- AlphaStream Intelligence - PostgreSQL Schema for Supabase
-- Run this in the Supabase SQL Editor to create all tables

-- ============================================================================
-- Master symbols table (full universe of tradeable securities)
-- ============================================================================
CREATE TABLE IF NOT EXISTS symbols (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    exchange TEXT,
    asset_type TEXT DEFAULT 'stock',
    sector TEXT,
    industry TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_sp500 BOOLEAN DEFAULT FALSE,
    is_nasdaq100 BOOLEAN DEFAULT FALSE,
    tier INTEGER DEFAULT 3,  -- 1=frequent (S&P500), 2=hourly, 3=daily
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symbols_tier ON symbols(tier);
CREATE INDEX IF NOT EXISTS idx_symbols_active ON symbols(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_symbols_sp500 ON symbols(is_sp500) WHERE is_sp500 = TRUE;
CREATE INDEX IF NOT EXISTS idx_symbols_exchange ON symbols(exchange);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS symbols_updated_at
    BEFORE UPDATE ON symbols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Main stocks table (snapshot data - latest prices/fundamentals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stocks (
    ticker TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    industry TEXT,
    price DOUBLE PRECISION NOT NULL,
    change_1d DOUBLE PRECISION DEFAULT 0.0,
    change_1w DOUBLE PRECISION DEFAULT 0.0,
    change_1m DOUBLE PRECISION DEFAULT 0.0,
    change_1y DOUBLE PRECISION DEFAULT 0.0,
    change_5y DOUBLE PRECISION DEFAULT 0.0,
    change_ytd DOUBLE PRECISION DEFAULT 0.0,
    volume BIGINT DEFAULT 0,
    high_1d DOUBLE PRECISION,
    low_1d DOUBLE PRECISION,
    high_1m DOUBLE PRECISION,
    low_1m DOUBLE PRECISION,
    high_1y DOUBLE PRECISION,
    low_1y DOUBLE PRECISION,
    high_5y DOUBLE PRECISION,
    low_5y DOUBLE PRECISION,
    pe_ratio DOUBLE PRECISION,
    eps DOUBLE PRECISION,
    dividend_yield DOUBLE PRECISION DEFAULT 0.0,
    market_cap DOUBLE PRECISION,
    shares_outstanding DOUBLE PRECISION,
    net_profit_margin DOUBLE PRECISION DEFAULT 0.0,
    gross_margin DOUBLE PRECISION DEFAULT 0.0,
    roe DOUBLE PRECISION DEFAULT 0.0,
    revenue_ttm DOUBLE PRECISION,
    beta DOUBLE PRECISION DEFAULT 1.0,
    institutional_ownership DOUBLE PRECISION DEFAULT 0.0,
    debt_to_equity DOUBLE PRECISION,
    year_founded INTEGER,
    website TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    weight DOUBLE PRECISION DEFAULT 0.0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_source TEXT DEFAULT 'fmp',
    is_sp500 BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_stocks_sector ON stocks(sector);
CREATE INDEX IF NOT EXISTS idx_stocks_market_cap ON stocks(market_cap DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_stocks_change_1d ON stocks(change_1d DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_stocks_last_updated ON stocks(last_updated);

-- ============================================================================
-- Market indices (SPX, NDX, DJI, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_indices (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    change DOUBLE PRECISION NOT NULL,
    change_pct DOUBLE PRECISION NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Macro indicators (economic data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS macro_indicators (
    indicator_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    change DOUBLE PRECISION,
    unit TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Treasury history (365 days of yield data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_history (
    date DATE PRIMARY KEY,
    yield_10y DOUBLE PRECISION NOT NULL,
    yield_2y DOUBLE PRECISION,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CPI history (inflation data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cpi_history (
    date DATE PRIMARY KEY,
    cpi_value DOUBLE PRECISION NOT NULL,
    mom_change DOUBLE PRECISION,
    yoy_change DOUBLE PRECISION,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- VIX history (volatility index)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vix_history (
    date DATE PRIMARY KEY,
    vix_close DOUBLE PRECISION NOT NULL,
    vix_high DOUBLE PRECISION,
    vix_low DOUBLE PRECISION,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Refresh log (audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_log (
    id SERIAL PRIMARY KEY,
    refresh_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stocks_updated INTEGER NOT NULL,
    data_source TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    duration_seconds DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_refresh_log_time ON refresh_log(refresh_time DESC);

-- ============================================================================
-- Alternative assets (crypto, commodities, currencies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alternative_assets (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    value DOUBLE PRECISION,
    change DOUBLE PRECISION,
    change_percent DOUBLE PRECISION,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fetch_error TEXT
);

-- ============================================================================
-- Sector performance (current snapshot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sector_performance (
    sector TEXT PRIMARY KEY,
    change_percent DOUBLE PRECISION NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Sector performance history (daily snapshots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sector_performance_history (
    date DATE NOT NULL,
    sector TEXT NOT NULL,
    exchange TEXT,
    average_change DOUBLE PRECISION NOT NULL,
    last_cached TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, sector)
);

CREATE INDEX IF NOT EXISTS idx_sector_history_date ON sector_performance_history(date DESC);

-- ============================================================================
-- Market movers (gainers, losers, actives)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_movers (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    name TEXT,
    price DOUBLE PRECISION NOT NULL,
    change DOUBLE PRECISION,
    change_percent DOUBLE PRECISION,
    volume BIGINT,
    category TEXT NOT NULL,
    market_cap DOUBLE PRECISION,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_movers_category ON market_movers(category);

-- ============================================================================
-- Earnings calendar
-- ============================================================================
CREATE TABLE IF NOT EXISTS earnings_calendar (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    company_name TEXT,
    report_date DATE NOT NULL,
    fiscal_period TEXT,
    eps_estimate DOUBLE PRECISION,
    eps_actual DOUBLE PRECISION,
    revenue_estimate DOUBLE PRECISION,
    revenue_actual DOUBLE PRECISION,
    time TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticker, report_date, fiscal_period)
);

CREATE INDEX IF NOT EXISTS idx_earnings_report_date ON earnings_calendar(report_date);

-- ============================================================================
-- News articles cache
-- ============================================================================
CREATE TABLE IF NOT EXISTS news_articles (
    id SERIAL PRIMARY KEY,
    ticker TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    published_date TIMESTAMPTZ,
    snippet TEXT,
    site TEXT,
    publisher TEXT,
    image TEXT,
    last_cached TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_ticker ON news_articles(ticker);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_date DESC);

-- ============================================================================
-- Price bars (intraday and EOD OHLCV data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS price_bars (
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    bar_time TIMESTAMPTZ NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume DOUBLE PRECISION,
    source TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, timeframe, bar_time)
);

CREATE INDEX IF NOT EXISTS idx_price_bars_lookup ON price_bars(symbol, timeframe, bar_time DESC);

-- ============================================================================
-- Company Profiles Cache (24-hour TTL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_profiles (
    symbol TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_updated ON company_profiles(last_updated);

-- ============================================================================
-- Stocks table additions for caching optimization
-- ============================================================================
-- Add view_count and last_viewed_at columns for popularity tracking
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Index for popular stocks prefetch
CREATE INDEX IF NOT EXISTS idx_stocks_view_count ON stocks(view_count DESC NULLS LAST) WHERE view_count > 0;

-- ============================================================================
-- Chat threads (user-scoped, 14-day retention from last activity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_threads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL,
    title         TEXT        NOT NULL DEFAULT '',
    context_label TEXT,
    chat_mode     TEXT,
    route_path    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days')
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user    ON chat_threads(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_threads_expires ON chat_threads(expires_at);

-- ============================================================================
-- Chat messages (cascade-deleted with their thread)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id  UUID        NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at ASC);

-- ============================================================================
-- Enable Row Level Security (optional - disabled for now since FastAPI handles auth)
-- ============================================================================
-- ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all" ON stocks FOR ALL USING (true);
