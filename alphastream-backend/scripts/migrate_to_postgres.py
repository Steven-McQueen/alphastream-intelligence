#!/usr/bin/env python3
"""
Data Migration Script: SQLite to PostgreSQL (Supabase)

This script exports data from the local SQLite database and imports it
into Supabase PostgreSQL.

Usage:
    1. Export from SQLite:
       python scripts/migrate_to_postgres.py export

    2. Import to PostgreSQL (requires DATABASE_URL in .env):
       python scripts/migrate_to_postgres.py import

    3. Full migration (export then import):
       python scripts/migrate_to_postgres.py migrate
"""

import sys
import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

# Tables to migrate (in order to handle dependencies)
TABLES = [
    'stocks',
    'market_indices',
    'macro_indicators',
    'treasury_history',
    'cpi_history',
    'vix_history',
    'alternative_assets',
    'sector_performance',
    'sector_performance_history',
    'market_movers',
    'earnings_calendar',
    'news_articles',
    'price_bars',
    'refresh_log'
]

EXPORT_DIR = Path(__file__).parent.parent / 'data' / 'export'
SQLITE_DB = Path(__file__).parent.parent / 'data' / 'stocks.db'


def export_sqlite():
    """Export all tables from SQLite to JSON files."""
    print("=" * 60)
    print("EXPORTING DATA FROM SQLITE")
    print("=" * 60)

    if not SQLITE_DB.exists():
        print(f"Error: SQLite database not found at {SQLITE_DB}")
        return False

    # Create export directory
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(SQLITE_DB))
    conn.row_factory = sqlite3.Row

    total_rows = 0
    for table in TABLES:
        try:
            cursor = conn.execute(f'SELECT * FROM {table}')
            rows = [dict(row) for row in cursor.fetchall()]

            # Convert datetime objects to strings
            for row in rows:
                for key, value in row.items():
                    if isinstance(value, datetime):
                        row[key] = value.isoformat()

            export_file = EXPORT_DIR / f'{table}.json'
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(rows, f, indent=2, default=str)

            print(f"  {table}: {len(rows)} rows exported")
            total_rows += len(rows)

        except sqlite3.OperationalError as e:
            print(f"  {table}: Table not found or error - {e}")

    conn.close()

    print("-" * 60)
    print(f"Total: {total_rows} rows exported to {EXPORT_DIR}")
    return True


def import_to_postgres():
    """Import JSON data into PostgreSQL."""
    print("=" * 60)
    print("IMPORTING DATA TO POSTGRESQL (SUPABASE)")
    print("=" * 60)

    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        print("Error: DATABASE_URL environment variable not set")
        print("Add your Supabase connection string to .env file")
        return False

    try:
        from database.postgres_manager import PostgresDatabaseManager
    except ImportError as e:
        print(f"Error importing PostgresDatabaseManager: {e}")
        print("Make sure SQLAlchemy and psycopg2-binary are installed")
        return False

    # Connect to PostgreSQL
    try:
        db = PostgresDatabaseManager(database_url)
        print("Connected to PostgreSQL")
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        return False

    total_rows = 0
    for table in TABLES:
        export_file = EXPORT_DIR / f'{table}.json'
        if not export_file.exists():
            print(f"  {table}: No export file found, skipping")
            continue

        with open(export_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not data:
            print(f"  {table}: Empty, skipping")
            continue

        try:
            imported = _import_table(db, table, data)
            print(f"  {table}: {imported} rows imported")
            total_rows += imported
        except Exception as e:
            print(f"  {table}: Error - {e}")

    print("-" * 60)
    print(f"Total: {total_rows} rows imported")
    return True


def _import_table(db, table: str, data: list) -> int:
    """Import data for a specific table."""
    if table == 'stocks':
        return db.insert_stocks_bulk(data)

    elif table == 'market_indices':
        for row in data:
            db.insert_or_update_index(
                row['symbol'], row['name'], row['value'],
                row['change'], row['change_pct']
            )
        return len(data)

    elif table == 'macro_indicators':
        for row in data:
            db.insert_or_update_indicator(
                row['indicator_id'], row['name'], row['value'],
                row.get('change'), row.get('unit', '%')
            )
        return len(data)

    elif table == 'treasury_history':
        for row in data:
            db.insert_treasury_history(
                row['date'], row['yield_10y'], row.get('yield_2y')
            )
        return len(data)

    elif table == 'cpi_history':
        for row in data:
            db.insert_cpi_history(
                row['date'], row['cpi_value'],
                row.get('mom_change'), row.get('yoy_change')
            )
        return len(data)

    elif table == 'vix_history':
        for row in data:
            db.insert_vix_history(
                row['date'], row['vix_close'],
                row.get('vix_high'), row.get('vix_low')
            )
        return len(data)

    elif table == 'alternative_assets':
        for row in data:
            db.insert_or_update_alternative_asset(
                row['symbol'], row['name'], row['asset_type'],
                row.get('value'), row.get('change'),
                row.get('change_percent'), row.get('fetch_error')
            )
        return len(data)

    elif table == 'sector_performance':
        for row in data:
            db.insert_or_update_sector_performance(
                row['sector'], row['change_percent']
            )
        return len(data)

    elif table == 'sector_performance_history':
        return db.upsert_sector_history_bulk(data)

    elif table == 'market_movers':
        db.clear_market_movers()
        for row in data:
            db.insert_market_mover(
                row['ticker'], row.get('name'), row['price'],
                row.get('change'), row.get('change_percent'),
                row.get('volume', 0), row['category'],
                row.get('market_cap')
            )
        return len(data)

    elif table == 'earnings_calendar':
        for row in data:
            db.insert_or_update_earning(
                row['ticker'], row.get('company_name'),
                row['report_date'], row.get('fiscal_period', ''),
                row.get('eps_estimate'), row.get('eps_actual'),
                row.get('revenue_estimate'), row.get('revenue_actual'),
                row.get('time')
            )
        return len(data)

    elif table == 'news_articles':
        return db.upsert_news_articles_bulk(data)

    elif table == 'price_bars':
        return db.upsert_price_bars_bulk(data)

    elif table == 'refresh_log':
        for row in data:
            db.log_refresh(
                row['stocks_updated'], row['data_source'],
                row['success'], row.get('duration_seconds', 0),
                row.get('error_message')
            )
        return len(data)

    return 0


def verify_migration():
    """Verify data was migrated correctly by comparing counts."""
    print("=" * 60)
    print("VERIFYING MIGRATION")
    print("=" * 60)

    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        print("Error: DATABASE_URL not set")
        return False

    if not SQLITE_DB.exists():
        print("SQLite database not found, skipping comparison")
        return True

    from database.postgres_manager import PostgresDatabaseManager

    # Connect to both databases
    sqlite_conn = sqlite3.connect(str(SQLITE_DB))
    pg_db = PostgresDatabaseManager(database_url)

    print(f"{'Table':<30} {'SQLite':<10} {'PostgreSQL':<10} {'Status'}")
    print("-" * 60)

    all_match = True
    for table in TABLES:
        try:
            # SQLite count
            sqlite_cursor = sqlite_conn.execute(f'SELECT COUNT(*) FROM {table}')
            sqlite_count = sqlite_cursor.fetchone()[0]
        except sqlite3.OperationalError:
            sqlite_count = 0

        # PostgreSQL count
        try:
            with pg_db.get_session() as session:
                from sqlalchemy import text
                result = session.execute(text(f'SELECT COUNT(*) FROM {table}'))
                pg_count = result.fetchone()[0]
        except Exception:
            pg_count = 0

        status = "OK" if sqlite_count == pg_count else "MISMATCH"
        if sqlite_count != pg_count:
            all_match = False

        print(f"{table:<30} {sqlite_count:<10} {pg_count:<10} {status}")

    sqlite_conn.close()
    print("-" * 60)
    return all_match


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nCommands: export, import, migrate, verify")
        return

    command = sys.argv[1].lower()

    if command == 'export':
        export_sqlite()

    elif command == 'import':
        import_to_postgres()

    elif command == 'migrate':
        if export_sqlite():
            print()
            import_to_postgres()

    elif command == 'verify':
        verify_migration()

    else:
        print(f"Unknown command: {command}")
        print("Commands: export, import, migrate, verify")


if __name__ == '__main__':
    main()
