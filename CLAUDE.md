# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlphaStream Intelligence is a financial intelligence terminal with a Python FastAPI backend and a React TypeScript frontend. The backend aggregates data from multiple financial APIs (FMP, FRED, yFinance, Perplexity AI) into a PostgreSQL database (Supabase), and the frontend provides real-time market dashboards, stock screening, watchlist management, and portfolio analytics.

## Repository Structure

```
alphastream-backend/         # FastAPI backend (port 8000)
alphastream-intelligence-frontend/  # React + Vite frontend (port 8080)
```

## Development Commands

### Backend

```bash
cd alphastream-backend
pip install -r requirements.txt
python main.py                    # Runs uvicorn on 0.0.0.0:8000
```

Backend requires a `.env` file in `alphastream-backend/` with API keys (FMP_API_KEY, FRED_API_KEY, FINNHUB_API_KEY, PERPLEXITY_API_KEY) and DATABASE_URL (Supabase PostgreSQL). Set `USE_SQLITE_FALLBACK=true` for local dev without Postgres.

### Frontend

```bash
cd alphastream-intelligence-frontend
npm install
npm run dev       # Vite dev server on port 8080
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

Frontend requires `.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and optionally `VITE_API_BASE_URL` (defaults to `http://localhost:8000`).

## Architecture

### Backend

- **Entry point**: `main.py` creates the FastAPI app, registers CORS middleware, includes all routers, and runs a startup event that bootstraps S&P 500 data if the database is empty, then starts the background refresh scheduler.
- **Routes** (`routes/`): Each domain has its own router module (health, screener, stock, market, earnings, watchlist, news, congress, charts, financials, macro, dcf, analyst, portfolio, universe, live). All prefixed with `/api/`.
- **Services** (`services/`): Business logic and external API integrations. `fmp_client.py` is the primary data source client (Financial Modeling Prep). `refresh_scheduler.py` runs background data refresh tasks on a schedule with market-hours detection.
- **Database** (`database/`): `db_manager.py` is the abstraction layer (exposes a global `db` singleton). `postgres_manager.py` handles PostgreSQL with SQLAlchemy connection pooling. Schema defined in `schema_postgres.sql`.
- **DTOs** (`dto/`): Response transformation and formatting.
- **Models** (`models.py`): Pydantic models for Stock, MarketIndex, MacroIndicator, Portfolio, etc.
- **Config** (`config.py`): All environment variables and constants loaded here. Import from this module, not `os.getenv` directly.

### Frontend

- **Framework**: React 18 + TypeScript + Vite (SWC plugin) + Tailwind CSS + shadcn/ui.
- **Routing**: React Router v6 in `App.tsx`. Public routes: `/login`, `/signup`. Protected routes wrapped in `ProtectedRoute` component: `/` (finance home), `/screener`, `/watchlist`, `/portfolio`, `/holdings`, `/market`, `/intelligence`, `/optimizer`, `/simulation`, `/settings`.
- **State management**: React Query (`@tanstack/react-query`) for server state. React Context (all under `contexts/`) for auth (`contexts/AuthContext`), market data (`contexts/MarketContext`), portfolio (`contexts/PortfolioContext`), watchlist (`contexts/WatchlistContext`), stock detail sheet (`contexts/StockDetailContext`).
- **API config**: All API calls use `API_BASE_URL` from `src/config/api.ts`. Never hardcode backend URLs.
- **Auth**: Supabase auth with email/password. Client initialized in `src/integrations/supabase/client.ts`.
- **UI components**: shadcn/ui primitives in `components/ui/`. Domain components organized by feature: `screener/`, `finance/`, `market/`, `charts/`, `layout/`, `auth/`, `intelligence/`, `portfolio/`, `holdings/`, `optimizer/`, `simulation/`, `chat/`.
- **Path alias**: `@` maps to `src/` (configured in vite.config.ts and tsconfig.json).
- **Design tokens**: All colors, fonts, and design tokens are defined in `src/index.css`. This is the single source of truth for the visual design system. Never hardcode color values or font families in components — always reference CSS custom properties from `index.css`.

### Data Flow

Backend polls financial APIs on a schedule and caches results in PostgreSQL. Frontend fetches from backend REST endpoints via React Query with its own caching layer. Market data is polled in `MarketContext` for real-time updates. The `StockDetailContext` manages the slide-out stock detail sheet shown across multiple pages.

### Key Database Tables

`symbols` (master universe with tier flags) -> `stocks` (latest quotes/fundamentals) -> `price_bars` (OHLCV history). Supporting tables: `market_indices`, `macro_indicators`, `earnings_calendar`, `news_articles`, `company_profiles`, `refresh_log`.

### Notebook (local Jupyter)

The in-app **Notebook** page (`/notebook`) connects to a **local Jupyter Server** each developer runs on their machine (not hosted by the app). Setup: `alphastream-notebooks/SETUP.md`. Do not hardcode personal conda env names in repo scripts or docs.


### Rules 
* Never hardcode colors or fonts directly into the components. Always refer to the index.css file, with clear comments that refers to the type.
* Be consistient with the coding and file placement, maintain a coherent coding structure 
* No emojis in the code