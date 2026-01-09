"""Initialize database with S&P 500 data and macro data"""
import sys
from pathlib import Path

# Add parent directory to path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.db_manager import db
from services.hybrid_importer import (
    fetch_and_import_sp500_hybrid,
    fetch_and_import_indices_from_fmp,
    fetch_and_import_sector_performance_from_fmp,
    fetch_and_import_market_movers_from_fmp,
)
from services.macro_importer import initialize_all_macro_data

print("=" * 60)
print("AlphaStream Intelligence Terminal - Database Setup")
print("=" * 60)

# ============================================================================
# STEP 1: CREATE DATABASE SCHEMA
# ============================================================================

print("\nStep 1: Creating database schema...")
db.init_database()
print(f"Database initialized at {db.db_path}")

# ============================================================================
# STEP 2: IMPORT S&P 500 DATA (HYBRID)
# ============================================================================

print("\nStep 2: Importing S&P 500 stocks (Hybrid: SP500Live + FMP)...")
stocks_count = fetch_and_import_sp500_hybrid()

if stocks_count > 0:
    print(f"{stocks_count} stocks imported successfully")
else:
    print("Warning: No stocks were imported")

# ============================================================================
# STEP 3: IMPORT MARKET INDICES (FMP)
# ============================================================================

print("\nStep 3: Importing market indices...")
indices_count = fetch_and_import_indices_from_fmp()
if indices_count == 0:
    print("  FMP failed, trying yfinance...")
    from services.hybrid_importer import fetch_and_import_indices_from_yfinance

    indices_count = fetch_and_import_indices_from_yfinance()

# ============================================================================
# STEP 4: CALCULATE SECTOR PERFORMANCE
# ============================================================================

print("\nStep 4: Importing sector performance from FMP...")
sectors_count = fetch_and_import_sector_performance_from_fmp()

# ============================================================================
# STEP 5: CALCULATE MARKET MOVERS
# ============================================================================

print("\nStep 5: Importing market movers from FMP...")
movers_count = fetch_and_import_market_movers_from_fmp(limit=10)

# ============================================================================
# STEP 6: IMPORT MACRO ECONOMIC DATA (FRED / existing)
# ============================================================================

print("\nStep 6: Importing macro economic data...")
macro_stats = initialize_all_macro_data()

# ============================================================================
# FINAL SUMMARY
# ============================================================================

print("\n" + "=" * 60)
print("Database setup complete!")
print(f"   - {stocks_count} S&P 500 stocks (Hybrid)")
print(f"   - {indices_count} market indices (FMP)")
print(f"   - {sectors_count} sectors (FMP)")
print(f"   - {movers_count} market movers (FMP)")
print(f"   - {macro_stats['indices']} market indices (legacy macro)")
print(f"   - {macro_stats['indicators']} macro indicators")
print(f"   - {macro_stats['assets']} alternative assets")
print(f"   - {macro_stats['treasury_days']} days of treasury history")
print(f"   - {macro_stats['cpi_months']} months of CPI history")
print(f"   - {macro_stats['vix_days']} days of VIX history")
print(f"   - Database location: {db.db_path}")
data_age = db.get_data_age()
if data_age is not None:
    print(f"   - Data age: {data_age:.2f} minutes")
else:
    print("   - Data age: Fresh (just imported)")
print("=" * 60 + "\n")
