import type { Portfolio, PortfolioHolding, StrategyTag, FactorExposure, Factor } from '@/types';
import { getStockByTicker } from './mockStocks';

// Sample Nordnet-style portfolio holdings
const PORTFOLIO_HOLDINGS_DATA: Array<{
  ticker: string;
  shares: number;
  avgCostBasis: number;
  strategy: StrategyTag;
}> = [
  // Core Quality Holdings (long-term)
  { ticker: 'AAPL', shares: 150, avgCostBasis: 142.50, strategy: 'Core Quality' },
  { ticker: 'MSFT', shares: 100, avgCostBasis: 285.00, strategy: 'Core Quality' },
  { ticker: 'GOOGL', shares: 50, avgCostBasis: 138.00, strategy: 'Core Quality' },
  { ticker: 'V', shares: 80, avgCostBasis: 245.00, strategy: 'Core Quality' },
  { ticker: 'JNJ', shares: 75, avgCostBasis: 158.00, strategy: 'Core Quality' },
  { ticker: 'UNH', shares: 25, avgCostBasis: 485.00, strategy: 'Core Quality' },
  { ticker: 'PG', shares: 60, avgCostBasis: 148.00, strategy: 'Core Quality' },
  { ticker: 'HD', shares: 40, avgCostBasis: 315.00, strategy: 'Core Quality' },
  
  // Growth Picks
  { ticker: 'NVDA', shares: 120, avgCostBasis: 425.00, strategy: 'Growth' },
  { ticker: 'META', shares: 45, avgCostBasis: 385.00, strategy: 'Growth' },
  { ticker: 'AMZN', shares: 60, avgCostBasis: 145.00, strategy: 'Growth' },
  { ticker: 'CRM', shares: 35, avgCostBasis: 265.00, strategy: 'Growth' },
  { ticker: 'NOW', shares: 20, avgCostBasis: 580.00, strategy: 'Growth' },
  
  // Tactical Positions
  { ticker: 'XOM', shares: 100, avgCostBasis: 95.00, strategy: 'Tactical' },
  { ticker: 'CVX', shares: 50, avgCostBasis: 155.00, strategy: 'Tactical' },
  { ticker: 'CAT', shares: 30, avgCostBasis: 285.00, strategy: 'Tactical' },
  
  // Macro Bets
  { ticker: 'LIN', shares: 25, avgCostBasis: 380.00, strategy: 'Macro Bet' },
  { ticker: 'NEE', shares: 60, avgCostBasis: 72.00, strategy: 'Macro Bet' },
  
  // Income
  { ticker: 'O', shares: 100, avgCostBasis: 58.00, strategy: 'Income' },
  { ticker: 'KO', shares: 120, avgCostBasis: 58.50, strategy: 'Income' },
  { ticker: 'PEP', shares: 40, avgCostBasis: 175.00, strategy: 'Income' },
];

function generatePortfolioHoldings(): PortfolioHolding[] {
  return PORTFOLIO_HOLDINGS_DATA.map((holding) => {
    const stock = getStockByTicker(holding.ticker);
    if (!stock) {
      throw new Error(`Stock not found: ${holding.ticker}`);
    }
    
    const currentPrice = stock.price;
    const marketValue = holding.shares * currentPrice;
    const costValue = holding.shares * holding.avgCostBasis;
    const unrealizedPnL = marketValue - costValue;
    const unrealizedPnLPercent = ((currentPrice - holding.avgCostBasis) / holding.avgCostBasis) * 100;
    const dailyPnL = marketValue * (stock.change1D / 100);
    
    return {
      ticker: holding.ticker,
      name: stock.name,
      sector: stock.sector,
      shares: holding.shares,
      avgCostBasis: holding.avgCostBasis,
      currentPrice,
      marketValue,
      weight: 0, // Will be calculated after totals
      unrealizedPnL,
      unrealizedPnLPercent,
      dailyPnL,
      dailyPnLPercent: stock.change1D,
      strategy: holding.strategy,
    };
  });
}

function calculatePortfolioWeights(holdings: PortfolioHolding[]): PortfolioHolding[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  return holdings.map((h) => ({
    ...h,
    weight: (h.marketValue / totalValue) * 100,
  }));
}

export function generateMockPortfolio(): Portfolio {
  let holdings = generatePortfolioHoldings();
  holdings = calculatePortfolioWeights(holdings);
  
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avgCostBasis, 0);
  const totalUnrealizedPnL = holdings.reduce((sum, h) => sum + h.unrealizedPnL, 0);
  const dailyPnL = holdings.reduce((sum, h) => sum + h.dailyPnL, 0);
  const dailyPnLPercent = (dailyPnL / totalValue) * 100;
  const cash = 45000; // $45k cash
  
  return {
    id: 'main-portfolio',
    name: 'Nordnet Main Portfolio',
    holdings,
    totalValue: totalValue + cash,
    totalCost,
    cash,
    ytdReturn: 18.5, // Mock YTD
    dailyPnL,
    dailyPnLPercent,
    totalUnrealizedPnL,
    volatility: 16.2, // Annualized vol
    sharpeRatio: 1.45,
    beta: 1.08,
    lastUpdated: new Date().toISOString(),
  };
}

// Factor exposures for the portfolio
export function generateFactorExposures(): FactorExposure[] {
  const factors: Factor[] = ['Momentum', 'Value', 'Quality', 'Size', 'Volatility', 'Growth', 'Dividend Yield'];
  
  return factors.map((factor) => ({
    factor,
    exposure: Math.round((Math.random() * 2 - 0.5) * 100) / 100, // -0.5 to 1.5
    contribution: Math.round((Math.random() * 4 - 1) * 100) / 100, // -1% to 3%
  }));
}

// Singleton cache
let portfolioCache: Portfolio | null = null;
let factorExposuresCache: FactorExposure[] | null = null;

export function getMockPortfolio(): Portfolio {
  if (!portfolioCache) {
    portfolioCache = generateMockPortfolio();
  }
  return portfolioCache;
}

export function getMockFactorExposures(): FactorExposure[] {
  if (!factorExposuresCache) {
    factorExposuresCache = generateFactorExposures();
  }
  return factorExposuresCache;
}

// Get holdings by strategy
export function getHoldingsByStrategy(strategy: StrategyTag): PortfolioHolding[] {
  return getMockPortfolio().holdings.filter((h) => h.strategy === strategy);
}

// Get sector allocation
export function getSectorAllocation(): Record<string, { value: number; weight: number }> {
  const portfolio = getMockPortfolio();
  const allocation: Record<string, { value: number; weight: number }> = {};
  
  portfolio.holdings.forEach((h) => {
    if (!allocation[h.sector]) {
      allocation[h.sector] = { value: 0, weight: 0 };
    }
    allocation[h.sector].value += h.marketValue;
    allocation[h.sector].weight += h.weight;
  });
  
  return allocation;
}
