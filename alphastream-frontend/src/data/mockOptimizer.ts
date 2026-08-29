import type { OptimizationResult, EfficientFrontierPoint, Trade } from '@/types';

// Generate efficient frontier points
function generateFrontierPoints(): EfficientFrontierPoint[] {
  const points: EfficientFrontierPoint[] = [];
  
  // Generate 20 points along the frontier
  for (let i = 0; i <= 20; i++) {
    const volatility = 8 + i * 1.2; // 8% to 32% volatility
    const expectedReturn = 4 + Math.sqrt(volatility - 8) * 6 - (i > 15 ? (i - 15) * 0.5 : 0);
    
    points.push({
      expectedReturn,
      volatility,
      sharpeRatio: (expectedReturn - 4.5) / volatility, // Risk-free rate ~4.5%
      weights: generateRandomWeights(),
    });
  }
  
  return points;
}

function generateRandomWeights(): Record<string, number> {
  const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'JPM', 'V', 'UNH', 'JNJ'];
  const weights: Record<string, number> = {};
  let remaining = 100;
  
  tickers.forEach((ticker, index) => {
    if (index === tickers.length - 1) {
      weights[ticker] = remaining;
    } else {
      const weight = Math.random() * (remaining / (tickers.length - index));
      weights[ticker] = Math.round(weight * 10) / 10;
      remaining -= weights[ticker];
    }
  });
  
  return weights;
}

export function getMockOptimizationResult(): OptimizationResult {
  const frontierPoints = generateFrontierPoints();
  
  // Current portfolio - suboptimal, below the frontier
  const currentPortfolio: EfficientFrontierPoint = {
    expectedReturn: 11.2,
    volatility: 18.5,
    sharpeRatio: 0.36,
    weights: {
      AAPL: 18.5,
      MSFT: 15.2,
      GOOGL: 8.3,
      AMZN: 7.1,
      NVDA: 12.4,
      META: 5.8,
      JPM: 10.2,
      V: 8.5,
      UNH: 7.2,
      JNJ: 6.8,
    },
  };
  
  // Optimal portfolio - on the frontier with same volatility but higher return
  const optimalPortfolio: EfficientFrontierPoint = {
    expectedReturn: 14.8,
    volatility: 18.2,
    sharpeRatio: 0.57,
    weights: {
      AAPL: 15.0,
      MSFT: 18.5,
      GOOGL: 12.0,
      AMZN: 5.0,
      NVDA: 20.0,
      META: 8.0,
      JPM: 6.5,
      V: 7.0,
      UNH: 5.0,
      JNJ: 3.0,
    },
  };
  
  // Generate trade suggestions
  const suggestedTrades: Trade[] = [
    {
      ticker: 'NVDA',
      name: 'NVIDIA Corporation',
      action: 'BUY',
      shares: 45,
      currentWeight: 12.4,
      targetWeight: 20.0,
      estimatedValue: 5420,
    },
    {
      ticker: 'MSFT',
      name: 'Microsoft Corporation',
      action: 'BUY',
      shares: 8,
      currentWeight: 15.2,
      targetWeight: 18.5,
      estimatedValue: 3360,
    },
    {
      ticker: 'GOOGL',
      name: 'Alphabet Inc.',
      action: 'BUY',
      shares: 21,
      currentWeight: 8.3,
      targetWeight: 12.0,
      estimatedValue: 3654,
    },
    {
      ticker: 'META',
      name: 'Meta Platforms',
      action: 'BUY',
      shares: 4,
      currentWeight: 5.8,
      targetWeight: 8.0,
      estimatedValue: 2280,
    },
    {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      action: 'SELL',
      shares: 18,
      currentWeight: 18.5,
      targetWeight: 15.0,
      estimatedValue: 3510,
    },
    {
      ticker: 'JPM',
      name: 'JPMorgan Chase',
      action: 'SELL',
      shares: 15,
      currentWeight: 10.2,
      targetWeight: 6.5,
      estimatedValue: 3150,
    },
    {
      ticker: 'JNJ',
      name: 'Johnson & Johnson',
      action: 'SELL',
      shares: 22,
      currentWeight: 6.8,
      targetWeight: 3.0,
      estimatedValue: 3520,
    },
    {
      ticker: 'AMZN',
      name: 'Amazon.com',
      action: 'SELL',
      shares: 11,
      currentWeight: 7.1,
      targetWeight: 5.0,
      estimatedValue: 2057,
    },
    {
      ticker: 'UNH',
      name: 'UnitedHealth Group',
      action: 'SELL',
      shares: 4,
      currentWeight: 7.2,
      targetWeight: 5.0,
      estimatedValue: 2280,
    },
  ];
  
  return {
    currentPortfolio,
    optimalPortfolio,
    frontierPoints,
    suggestedTrades,
  };
}

export interface OptimizationConstraints {
  maxPositionSize: number; // percentage
  minPositionSize: number; // percentage
  maxSectorWeight: number; // percentage
  turnoverLimit: number; // percentage
  excludeTickers: string[];
}

export const DEFAULT_CONSTRAINTS: OptimizationConstraints = {
  maxPositionSize: 25,
  minPositionSize: 2,
  maxSectorWeight: 35,
  turnoverLimit: 30,
  excludeTickers: [],
};
