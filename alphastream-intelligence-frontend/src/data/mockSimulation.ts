// Shadow portfolio and simulation data

export interface ShadowPortfolio {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  holdings: ShadowHolding[];
  performance: PerformancePoint[];
}

export interface ShadowHolding {
  ticker: string;
  name: string;
  weight: number;
  shares: number;
  avgCost: number;
  currentPrice: number;
}

export interface PerformancePoint {
  date: string;
  portfolioValue: number;
  shadowValue: number;
  benchmarkValue: number;
}

export interface DivergenceData {
  date: string;
  divergence: number;
  cumulativeDivergence: number;
  portfolioReturn: number;
  shadowReturn: number;
}

export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  changes: ScenarioChange[];
  projectedReturn: number;
  projectedRisk: number;
  impactVsBaseline: number;
}

export interface ScenarioChange {
  type: 'add' | 'remove' | 'rebalance' | 'substitute';
  ticker?: string;
  newTicker?: string;
  targetWeight?: number;
  amount?: number;
}

// Generate mock shadow portfolios
export function generateShadowPortfolios(): ShadowPortfolio[] {
  return [
    {
      id: 'shadow-1',
      name: 'Tech-Heavy Alternative',
      description: 'What if we had allocated 40% to tech?',
      createdAt: new Date('2024-01-15'),
      holdings: [
        { ticker: 'AAPL', name: 'Apple Inc.', weight: 15, shares: 50, avgCost: 175, currentPrice: 192 },
        { ticker: 'MSFT', name: 'Microsoft Corp.', weight: 15, shares: 30, avgCost: 380, currentPrice: 415 },
        { ticker: 'NVDA', name: 'NVIDIA Corp.', weight: 10, shares: 15, avgCost: 450, currentPrice: 875 },
        { ticker: 'GOOGL', name: 'Alphabet Inc.', weight: 10, shares: 40, avgCost: 140, currentPrice: 175 },
        { ticker: 'SPY', name: 'S&P 500 ETF', weight: 30, shares: 50, avgCost: 450, currentPrice: 520 },
        { ticker: 'BND', name: 'Bond ETF', weight: 20, shares: 100, avgCost: 72, currentPrice: 70 },
      ],
      performance: [],
    },
    {
      id: 'shadow-2',
      name: 'Dividend Focus',
      description: 'High-yield dividend strategy comparison',
      createdAt: new Date('2024-02-01'),
      holdings: [
        { ticker: 'VYM', name: 'Vanguard High Div', weight: 25, shares: 100, avgCost: 110, currentPrice: 118 },
        { ticker: 'SCHD', name: 'Schwab US Dividend', weight: 25, shares: 80, avgCost: 75, currentPrice: 82 },
        { ticker: 'JNJ', name: 'Johnson & Johnson', weight: 15, shares: 40, avgCost: 155, currentPrice: 162 },
        { ticker: 'PG', name: 'Procter & Gamble', weight: 15, shares: 35, avgCost: 150, currentPrice: 168 },
        { ticker: 'KO', name: 'Coca-Cola Co.', weight: 10, shares: 100, avgCost: 58, currentPrice: 62 },
        { ticker: 'BND', name: 'Bond ETF', weight: 10, shares: 50, avgCost: 72, currentPrice: 70 },
      ],
      performance: [],
    },
    {
      id: 'shadow-3',
      name: 'Conservative Mix',
      description: '60/40 traditional allocation',
      createdAt: new Date('2024-03-01'),
      holdings: [
        { ticker: 'VTI', name: 'Total Stock Market', weight: 40, shares: 80, avgCost: 220, currentPrice: 265 },
        { ticker: 'VXUS', name: 'Intl Stocks', weight: 20, shares: 120, avgCost: 55, currentPrice: 62 },
        { ticker: 'BND', name: 'US Bonds', weight: 25, shares: 150, avgCost: 72, currentPrice: 70 },
        { ticker: 'BNDX', name: 'Intl Bonds', weight: 15, shares: 100, avgCost: 48, currentPrice: 47 },
      ],
      performance: [],
    },
  ];
}

// Generate performance comparison data
export function generatePerformanceComparison(months: number = 12): PerformancePoint[] {
  const data: PerformancePoint[] = [];
  let portfolioValue = 100000;
  let shadowValue = 100000;
  let benchmarkValue = 100000;
  
  const now = new Date();
  
  for (let i = months; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    
    // Simulate different return patterns
    const portfolioReturn = (Math.random() - 0.45) * 0.08;
    const shadowReturn = (Math.random() - 0.42) * 0.09;
    const benchmarkReturn = (Math.random() - 0.47) * 0.07;
    
    portfolioValue *= (1 + portfolioReturn);
    shadowValue *= (1 + shadowReturn);
    benchmarkValue *= (1 + benchmarkReturn);
    
    data.push({
      date: date.toISOString().split('T')[0],
      portfolioValue: Math.round(portfolioValue),
      shadowValue: Math.round(shadowValue),
      benchmarkValue: Math.round(benchmarkValue),
    });
  }
  
  return data;
}

// Generate divergence tracking data
export function generateDivergenceData(months: number = 12): DivergenceData[] {
  const data: DivergenceData[] = [];
  let cumulativeDivergence = 0;
  const now = new Date();
  
  for (let i = months; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    
    const portfolioReturn = (Math.random() - 0.45) * 8;
    const shadowReturn = (Math.random() - 0.42) * 9;
    const divergence = portfolioReturn - shadowReturn;
    cumulativeDivergence += divergence;
    
    data.push({
      date: date.toISOString().split('T')[0],
      divergence: Number(divergence.toFixed(2)),
      cumulativeDivergence: Number(cumulativeDivergence.toFixed(2)),
      portfolioReturn: Number(portfolioReturn.toFixed(2)),
      shadowReturn: Number(shadowReturn.toFixed(2)),
    });
  }
  
  return data;
}

// Generate what-if scenarios
export function generateWhatIfScenarios(): WhatIfScenario[] {
  return [
    {
      id: 'scenario-1',
      name: 'Add NVIDIA Position',
      description: 'Add 5% allocation to NVIDIA',
      changes: [
        { type: 'add', ticker: 'NVDA', targetWeight: 5 },
        { type: 'rebalance', ticker: 'SPY', targetWeight: -5 },
      ],
      projectedReturn: 14.2,
      projectedRisk: 18.5,
      impactVsBaseline: 2.3,
    },
    {
      id: 'scenario-2',
      name: 'Reduce Tech Exposure',
      description: 'Cut tech allocation by 10%',
      changes: [
        { type: 'rebalance', ticker: 'AAPL', targetWeight: -5 },
        { type: 'rebalance', ticker: 'MSFT', targetWeight: -5 },
        { type: 'add', ticker: 'VYM', targetWeight: 10 },
      ],
      projectedReturn: 9.8,
      projectedRisk: 12.3,
      impactVsBaseline: -1.5,
    },
    {
      id: 'scenario-3',
      name: 'Increase Bond Allocation',
      description: 'Move to 40% bonds for defensive positioning',
      changes: [
        { type: 'rebalance', ticker: 'BND', targetWeight: 20 },
        { type: 'rebalance', ticker: 'SPY', targetWeight: -20 },
      ],
      projectedReturn: 6.5,
      projectedRisk: 8.2,
      impactVsBaseline: -4.8,
    },
    {
      id: 'scenario-4',
      name: 'Substitute GOOGL for META',
      description: 'Replace Google position with Meta',
      changes: [
        { type: 'substitute', ticker: 'GOOGL', newTicker: 'META' },
      ],
      projectedReturn: 12.8,
      projectedRisk: 16.1,
      impactVsBaseline: 1.1,
    },
    {
      id: 'scenario-5',
      name: 'Add International Exposure',
      description: 'Add 15% international allocation',
      changes: [
        { type: 'add', ticker: 'VXUS', targetWeight: 15 },
        { type: 'rebalance', ticker: 'VTI', targetWeight: -15 },
      ],
      projectedReturn: 10.5,
      projectedRisk: 14.8,
      impactVsBaseline: -0.8,
    },
  ];
}

// Calculate scenario impact
export interface ScenarioImpact {
  metric: string;
  baseline: number;
  scenario: number;
  change: number;
  changePercent: number;
}

export function calculateScenarioImpact(scenario: WhatIfScenario): ScenarioImpact[] {
  const baselineReturn = 11.3;
  const baselineRisk = 15.2;
  const baselineSharpe = 0.74;
  const baselineMaxDrawdown = -18.5;
  
  const newSharpe = scenario.projectedReturn / scenario.projectedRisk;
  const drawdownChange = (scenario.projectedRisk - baselineRisk) * 1.2;
  
  return [
    {
      metric: 'Expected Return',
      baseline: baselineReturn,
      scenario: scenario.projectedReturn,
      change: scenario.projectedReturn - baselineReturn,
      changePercent: ((scenario.projectedReturn - baselineReturn) / baselineReturn) * 100,
    },
    {
      metric: 'Volatility',
      baseline: baselineRisk,
      scenario: scenario.projectedRisk,
      change: scenario.projectedRisk - baselineRisk,
      changePercent: ((scenario.projectedRisk - baselineRisk) / baselineRisk) * 100,
    },
    {
      metric: 'Sharpe Ratio',
      baseline: baselineSharpe,
      scenario: Number(newSharpe.toFixed(2)),
      change: Number((newSharpe - baselineSharpe).toFixed(2)),
      changePercent: ((newSharpe - baselineSharpe) / baselineSharpe) * 100,
    },
    {
      metric: 'Max Drawdown',
      baseline: baselineMaxDrawdown,
      scenario: Number((baselineMaxDrawdown + drawdownChange).toFixed(1)),
      change: Number(drawdownChange.toFixed(1)),
      changePercent: (drawdownChange / Math.abs(baselineMaxDrawdown)) * 100,
    },
  ];
}
