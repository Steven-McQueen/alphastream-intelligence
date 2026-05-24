# Supabase Migration Runbook

This guide walks you through migrating AlphaStream Intelligence from SQLite to Supabase PostgreSQL.

## Prerequisites

- Supabase account with a project created
- Python 3.9+
- Access to the Supabase dashboard

---

## Step 1: Install Dependencies

```bash
cd alphastream-backend
pip install -r requirements.txt
```

This installs SQLAlchemy and psycopg2-binary for PostgreSQL connectivity.

---

## Step 2: Get Your Supabase Connection String

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** > **Database**
3. Find the **Connection string** section
4. Copy the **URI** (starts with `postgresql://`)
5. Replace `[YOUR-PASSWORD]` with your database password

The format is:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## Step 3: Configure Environment

Create or update `alphastream-backend/.env`:

```env
# Supabase PostgreSQL connection
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Optional: Force SQLite for local testing (default: false)
# USE_SQLITE_FALLBACK=true

# Your existing API keys
FMP_API_KEY=your_fmp_key
FRED_API_KEY=your_fred_key
FINNHUB_API_KEY=your_finnhub_key
```

**Important:** Never commit `.env` to version control.

---

## Step 4: Create Tables in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `database/schema_postgres.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

You should see all 14 tables created:
- stocks
- market_indices
- macro_indicators
- treasury_history
- cpi_history
- vix_history
- refresh_log
- alternative_assets
- sector_performance
- sector_performance_history
- market_movers
- earnings_calendar
- news_articles
- price_bars

---

## Step 5: Migrate Existing Data (Optional)

If you have data in SQLite that you want to migrate:

```bash
cd alphastream-backend

# Export from SQLite
python scripts/migrate_to_postgres.py export

# Import to PostgreSQL
python scripts/migrate_to_postgres.py import

# Verify migration
python scripts/migrate_to_postgres.py verify
```

Or do it all in one step:
```bash
python scripts/migrate_to_postgres.py migrate
```

---

## Step 6: Start the Backend

```bash
cd alphastream-backend
python -m uvicorn main:app --reload --port 8000
```

You should see:
```
Using PostgreSQL database (Supabase)
INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## Step 7: Validate Endpoints

Test these key endpoints to verify the migration:

```bash
# Stock universe
curl http://localhost:8000/api/universe/core | head

# Market indices
curl http://localhost:8000/api/macro/indices

# Sector performance
curl http://localhost:8000/api/market/sectors

# Stock chart data
curl "http://localhost:8000/api/stock/AAPL/chart?timeframe=1day&limit=10"
```

Expected behavior:
- `/api/universe/core` - Returns list of S&P 500 stocks
- `/api/macro/indices` - Returns SPX, NDX, DJI, etc.
- `/api/market/sectors` - Returns sector performance
- `/api/stock/{ticker}/chart` - Returns OHLCV price data

---

## Step 8: Verify Scheduled Imports

The background scheduler should still run and populate data:

1. Start the backend
2. Wait 1-2 minutes for the scheduler to trigger
3. Check the refresh log:

```bash
curl http://localhost:8000/api/data/status
```

You should see recent refresh times updating.

---

## Troubleshooting

### Connection Errors

**Error:** `could not connect to server`
- Check your DATABASE_URL is correct
- Verify your IP is allowed in Supabase (Settings > Database > Connection Pooling)
- Make sure you're using the pooler URL (port 6543) not direct connection

**Error:** `password authentication failed`
- Double-check the password in DATABASE_URL
- Reset database password in Supabase if needed

### Import Errors

**Error:** `relation "stocks" does not exist`
- Run the schema SQL in Supabase SQL Editor first (Step 4)

**Error:** `duplicate key value violates unique constraint`
- Data already exists; the upsert should handle this
- Try clearing the table and re-importing

### Performance Issues

If queries are slow:
1. Check indexes were created (they're in schema_postgres.sql)
2. Use the Supabase dashboard to view query performance
3. Consider enabling connection pooling in Supabase settings

---

## Rollback to SQLite

If you need to switch back to SQLite temporarily:

1. Set in `.env`:
   ```
   USE_SQLITE_FALLBACK=true
   ```

2. Restart the backend:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

You should see:
```
Using SQLite database (local fallback)
```

---

## Architecture Overview

```
Frontend (React)
    │
    ▼
FastAPI Backend (port 8000)
    │
    ├─► PostgresDatabaseManager (when DATABASE_URL set)
    │       │
    │       ▼
    │   Supabase PostgreSQL
    │
    └─► SQLiteDatabaseManager (fallback)
            │
            ▼
        Local stocks.db
```

The frontend always calls FastAPI. The database layer is abstracted, allowing
seamless switching between PostgreSQL and SQLite.

---

## Files Changed

| File | Change |
|------|--------|
| `requirements.txt` | Added sqlalchemy, psycopg2-binary |
| `config.py` | Added DATABASE_URL config |
| `database/db_manager.py` | Added PostgreSQL support via factory function |
| `database/postgres_manager.py` | New PostgreSQL database manager |
| `database/schema_postgres.sql` | PostgreSQL schema for Supabase |
| `scripts/migrate_to_postgres.py` | Data migration script |

---

## Support

If you encounter issues:
1. Check the Supabase dashboard for database logs
2. Review FastAPI logs for SQL errors
3. Verify environment variables are loaded correctly
