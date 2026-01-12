import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from services.fmp_client import fmp_client


def main():
    print("Testing FMP Client...")

    print("\n1. Single Quote (AAPL):")
    quote = fmp_client.get_quote("AAPL")
    if quote:
        print(
            f"   {quote.get('name', 'AAPL')}: ${quote.get('price', 0):.2f} "
            f"({quote.get('changesPercentage', 0):+.2f}%)"
        )
    else:
        print("   No quote returned")

    print("\n2. Batch Quotes (AAPL, MSFT, GOOGL):")
    quotes = fmp_client.get_batch_quotes(["AAPL", "MSFT", "GOOGL"])
    for q in quotes:
        print(f"   {q.get('symbol')}: ${q.get('price', 0):.2f}")

    print("\n3. Sector Performance (snapshot):")
    sectors = fmp_client.get_sector_performance_snapshot()
    for sector in sectors[:5]:
        print(f"   {sector.get('sector')}: {sector.get('averageChange')}")

    print("\n[OK] FMP Client Test Complete!")


if __name__ == "__main__":
    main()

