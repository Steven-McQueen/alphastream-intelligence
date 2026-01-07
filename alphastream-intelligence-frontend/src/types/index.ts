// AlphaStream Type Definitions
// Ready for Python API integration

// ============ Stock Universe ============

export interface Stock {
  ticker: string;
  name: string;
  sector: Sector;
  industry: string;
  
  // Price & Performance
  price: number;
  change1D: number;
  change1W: number;
  change1M: number;
  change1Y: number;
  change5Y?: number;
  changeYTD?: number;
  volume: number;
  avgVolume?: number;
  
  // High/Low ranges
  high1D?: number;
  low1D?: number;
  high1M?: number;
  low1M?: number;
  high1Y?: number;
  low1Y?: number;
  high5Y?: number;
  low5Y?: number;
  
  // Valuation
  peRatio: number | null;
  eps?: number;
  dividendYield?: number;
  marketCap: number;
  sharesOutstanding?: number;
  
  // Profitability (NEW)
  netProfitMargin?: number;
  grossMargin?: number;
  roe?: number;
  revenue?: number;
  
  // Risk & Ownership (NEW)
  beta?: number;
  institutionalOwnership?: number;
  debtToEquity?: number | null;
  
  // Company Info (NEW)
  yearFounded?: number;
  website?: string;
  city?: string;
  state?: string;
  zip?: string;
  
  // Quality scores (keep existing)
  qualityScore?: number;
  momentumScore?: number;
  valueScore?: number;
  sentimentScore?: number;
  
  // Metadata
  catalysts?: CatalystTag[];
  updatedAt?: string;
  dataSource?: string;
}

export type Sector = 
  | 'Technology'
  | 'Healthcare'
  | 'Financials'
  | 'Consumer Discretionary'
  | 'Consumer Staples'
  | 'Industrials'
  | 'Energy'
  | 'Materials'
  | 'Utilities'
  | 'Real Estate'
  | 'Communication Services';

export type CatalystTag = 
  | 'Earnings Soon'
  | 'Analyst Upgrade'
  | 'Analyst Downgrade'
  | 'Insider Buying'
  | 'Insider Selling'
  | 'New Product'
  | 'M&A Target'
  | 'Dividend Increase'
  | 'Buyback'
  | 'Guidance Raised'
  | 'Guidance Lowered'
  | 'Sector Rotation'
  | 'Momentum Breakout'
  | 'Value Opportunity';

// ============ Portfolio ============

export interface PortfolioHolding {
  ticker: string;
  name: string;
  sector: Sector;
  shares: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  weight: number; // percentage of portfolio
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  strategy: StrategyTag;
}

export type StrategyTag = 
  | 'Core Quality'
  | 'Tactical'
  | 'Macro Bet'
  | 'Income'
  | 'Growth';

export interface Portfolio {
  id: string;
  name: string;
  holdings: PortfolioHolding[];
  totalValue: number;
  totalCost: number;
  cash: number;
  ytdReturn: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  totalUnrealizedPnL: number;
  volatility: number; // annualized
  sharpeRatio: number;
  beta: number;
  lastUpdated: string;
}

export interface PortfolioSummary {
  totalValue: number;
  cash: number;
  ytdReturn: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  volatility: number;
  sharpeRatio: number;
}

// ============ Market Data ============

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
}

export interface MacroIndicator {
  name: string;
  value: number;
  previousValue: number;
  change: number;
  unit: string;
  lastUpdated: string;
}

export interface SectorPerformance {
  sector: Sector;
  change1D: number;
  change1W: number;
  change1M: number;
  change1Y: number;
}

export type MarketRegime = 'Risk-On' | 'Risk-Off' | 'Neutral';
export type MarketStatus = 'Open' | 'Closed' | 'Pre-Market' | 'After-Hours';

export interface MarketState {
  status: MarketStatus;
  regime: MarketRegime;
  regimeProbabilities: {
    riskOn: number;
    riskOff: number;
    neutral: number;
  };
  indices: MarketIndex[];
  cryptoPrices: CryptoPrice[];
  macroIndicators: MacroIndicator[];
  sectorPerformance: SectorPerformance[];
  lastUpdated: string;
}

// ============ Factor Exposures ============

export interface FactorExposure {
  factor: Factor;
  exposure: number; // z-score, typically -3 to +3
  contribution: number; // contribution to portfolio return
}

export type Factor = 
  | 'Momentum'
  | 'Value'
  | 'Quality'
  | 'Size'
  | 'Volatility'
  | 'Growth'
  | 'Dividend Yield';

// ============ Optimizer ============

export interface EfficientFrontierPoint {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  weights: Record<string, number>; // ticker -> weight
}

export interface OptimizationResult {
  currentPortfolio: EfficientFrontierPoint;
  optimalPortfolio: EfficientFrontierPoint;
  frontierPoints: EfficientFrontierPoint[];
  suggestedTrades: Trade[];
}

export interface Trade {
  ticker: string;
  name: string;
  action: 'BUY' | 'SELL';
  shares: number;
  currentWeight: number;
  targetWeight: number;
  estimatedValue: number;
}

// ============ AI Chat ============

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  widgets?: ChatWidget[];
}

export interface ChatWidget {
  type: 'table' | 'chart' | 'insight';
  title: string;
  data: unknown;
}

export interface ChatContext {
  portfolio: PortfolioSummary;
  regime: MarketRegime;
  universeSize: number;
}

// ============ Simulation ============

export interface ShadowPortfolio extends Portfolio {
  parentPortfolioId: string;
  divergence: number; // tracking error vs parent
}

export interface SimulationComparison {
  metric: string;
  liveValue: number;
  shadowValue: number;
  difference: number;
}

// ============ Market News ============

export interface MarketNewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  category: 'macro' | 'earnings' | 'sector' | 'geopolitical' | 'fed' | 'general';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  tickers?: string[];
  url?: string;
}
