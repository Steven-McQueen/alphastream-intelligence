/** Canonical names and blurbs for quoted market indices. */

const INDEX_NAMES: Record<string, string> = {
  SPX: "S&P 500",
  NDX: "NASDAQ Composite",
  DJI: "Dow Jones Industrial Average",
  RUT: "Russell 2000",
  VIX: "CBOE Volatility Index",
  GSPC: "S&P 500",
  IXIC: "NASDAQ Composite",
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ Composite",
  "^DJI": "Dow Jones Industrial Average",
  "^RUT": "Russell 2000",
  "^VIX": "CBOE Volatility Index",
  "^SPX": "S&P 500",
  "^NDX": "NASDAQ Composite",
};

const INDEX_ABOUT: Record<string, string> = {
  SPX: "The S&P 500 is a market-capitalization-weighted index of 500 leading publicly traded companies in the United States.",
  GSPC: "The S&P 500 is a market-capitalization-weighted index of 500 leading publicly traded companies in the United States.",
  NDX: "The NASDAQ Composite tracks all domestic and international common stocks listed on the Nasdaq Stock Market.",
  IXIC: "The NASDAQ Composite tracks all domestic and international common stocks listed on the Nasdaq Stock Market.",
  DJI: "The Dow Jones Industrial Average is a price-weighted index of 30 large, publicly owned U.S. companies.",
  RUT: "The Russell 2000 measures the performance of approximately 2,000 small-cap U.S. companies.",
  VIX: "The CBOE Volatility Index estimates the 30-day expected volatility of the U.S. stock market, derived from S&P 500 options.",
};

export type IndexInstrument = {
  symbol: string;
  name: string;
};

function indexLookupKey(symbol: string): string {
  return symbol.replace(/^\^/, "").toUpperCase();
}

export function getIndexDisplayName(symbol: string, fallback?: string): string {
  return INDEX_NAMES[symbol] || INDEX_NAMES[indexLookupKey(symbol)] || fallback || symbol;
}

export function getIndexAbout(symbol: string): string | undefined {
  return INDEX_ABOUT[indexLookupKey(symbol)] || INDEX_ABOUT[symbol];
}

export function isIndexSymbol(symbol: string): boolean {
  if (!symbol) return false;
  if (symbol.startsWith("^")) return true;
  return indexLookupKey(symbol) in INDEX_NAMES || symbol.toUpperCase() in INDEX_NAMES;
}
