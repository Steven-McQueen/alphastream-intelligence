export interface MonteCarloResult {
  simulations: number[][];
  finalValues: number[];
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  probabilityOfLoss: number;
  probabilityOfTarget: number;
  expectedValue: number;
  volatilityOfOutcomes: number;
  // Risk metrics
  var95: number; // 95% VaR (dollar amount)
  var99: number; // 99% VaR (dollar amount)
  cvar95: number; // 95% CVaR / Expected Shortfall
  cvar99: number; // 99% CVaR / Expected Shortfall
  var95Pct: number; // 95% VaR as percentage
  var99Pct: number; // 99% VaR as percentage
  cvar95Pct: number; // 95% CVaR as percentage
  cvar99Pct: number; // 99% CVaR as percentage
}

export interface MonteCarloParams {
  initialValue: number;
  expectedReturn: number; // annualized
  volatility: number; // annualized
  timeHorizonYears: number;
  numSimulations: number;
  targetReturn: number; // target total return %
}

// Box-Muller transform for normal random numbers
function randomNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function runMonteCarloSimulation(params: MonteCarloParams): MonteCarloResult {
  const {
    initialValue,
    expectedReturn,
    volatility,
    timeHorizonYears,
    numSimulations,
    targetReturn,
  } = params;

  const monthlyReturn = expectedReturn / 12 / 100;
  const monthlyVol = volatility / Math.sqrt(12) / 100;
  const numMonths = timeHorizonYears * 12;

  const simulations: number[][] = [];
  const finalValues: number[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = [initialValue];
    let value = initialValue;

    for (let month = 0; month < numMonths; month++) {
      const randomShock = randomNormal();
      const monthlyGrowth = monthlyReturn + monthlyVol * randomShock;
      value = value * (1 + monthlyGrowth);
      path.push(value);
    }

    simulations.push(path);
    finalValues.push(value);
  }

  // Sort final values for percentile calculation
  const sortedFinals = [...finalValues].sort((a, b) => a - b);
  
  const getPercentile = (p: number) => {
    const index = Math.floor(p * sortedFinals.length);
    return sortedFinals[Math.min(index, sortedFinals.length - 1)];
  };

  const targetValue = initialValue * (1 + targetReturn / 100);
  const probabilityOfLoss = finalValues.filter(v => v < initialValue).length / numSimulations;
  const probabilityOfTarget = finalValues.filter(v => v >= targetValue).length / numSimulations;
  const expectedValue = finalValues.reduce((a, b) => a + b, 0) / numSimulations;
  
  const mean = expectedValue;
  const variance = finalValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numSimulations;
  const volatilityOfOutcomes = Math.sqrt(variance) / initialValue * 100;

  // Calculate VaR (Value at Risk) - potential loss at confidence level
  // VaR is the loss amount at the given percentile (how much you could lose)
  const var95Value = getPercentile(0.05); // 5th percentile for 95% confidence
  const var99Value = getPercentile(0.01); // 1st percentile for 99% confidence
  const var95 = Math.max(0, initialValue - var95Value); // Loss amount
  const var99 = Math.max(0, initialValue - var99Value);
  const var95Pct = (var95 / initialValue) * 100;
  const var99Pct = (var99 / initialValue) * 100;

  // Calculate CVaR (Conditional VaR / Expected Shortfall)
  // Average of all losses worse than VaR
  const worstCases95 = sortedFinals.slice(0, Math.floor(numSimulations * 0.05));
  const worstCases99 = sortedFinals.slice(0, Math.floor(numSimulations * 0.01));
  
  const avgWorst95 = worstCases95.length > 0 
    ? worstCases95.reduce((a, b) => a + b, 0) / worstCases95.length 
    : var95Value;
  const avgWorst99 = worstCases99.length > 0 
    ? worstCases99.reduce((a, b) => a + b, 0) / worstCases99.length 
    : var99Value;
  
  const cvar95 = Math.max(0, initialValue - avgWorst95);
  const cvar99 = Math.max(0, initialValue - avgWorst99);
  const cvar95Pct = (cvar95 / initialValue) * 100;
  const cvar99Pct = (cvar99 / initialValue) * 100;

  return {
    simulations,
    finalValues,
    percentiles: {
      p5: getPercentile(0.05),
      p25: getPercentile(0.25),
      p50: getPercentile(0.50),
      p75: getPercentile(0.75),
      p95: getPercentile(0.95),
    },
    probabilityOfLoss,
    probabilityOfTarget,
    expectedValue,
    volatilityOfOutcomes,
    var95,
    var99,
    cvar95,
    cvar99,
    var95Pct,
    var99Pct,
    cvar95Pct,
    cvar99Pct,
  };
}

// Generate histogram data for distribution chart
export function generateHistogramData(finalValues: number[], initialValue: number, bins: number = 30) {
  const returns = finalValues.map(v => ((v - initialValue) / initialValue) * 100);
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const binWidth = (max - min) / bins;

  const histogram: { returnRange: string; midpoint: number; count: number; frequency: number }[] = [];
  
  for (let i = 0; i < bins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    const midpoint = (binStart + binEnd) / 2;
    const count = returns.filter(r => r >= binStart && r < binEnd).length;
    
    histogram.push({
      returnRange: `${binStart.toFixed(0)}% - ${binEnd.toFixed(0)}%`,
      midpoint: Math.round(midpoint),
      count,
      frequency: count / finalValues.length,
    });
  }

  return histogram;
}

// Generate fan chart data (percentile bands over time)
export function generateFanChartData(simulations: number[][], initialValue: number) {
  const numMonths = simulations[0].length;
  const fanData: {
    month: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  }[] = [];

  for (let month = 0; month < numMonths; month++) {
    const valuesAtMonth = simulations.map(sim => sim[month]);
    const sorted = [...valuesAtMonth].sort((a, b) => a - b);
    
    const getPercentile = (p: number) => {
      const index = Math.floor(p * sorted.length);
      return ((sorted[Math.min(index, sorted.length - 1)] - initialValue) / initialValue) * 100;
    };

    fanData.push({
      month,
      p5: getPercentile(0.05),
      p25: getPercentile(0.25),
      p50: getPercentile(0.50),
      p75: getPercentile(0.75),
      p95: getPercentile(0.95),
    });
  }

  return fanData;
}

// Risk contribution data for holdings
export interface HoldingRiskContribution {
  ticker: string;
  name: string;
  weight: number;
  volatility: number;
  beta: number;
  marginalVaR: number;
  componentVaR: number;
  contributionPct: number;
  correlationToPortfolio: number;
}

export function generateRiskContributions(portfolioVaR: number): HoldingRiskContribution[] {
  // Mock holdings with realistic risk metrics
  const holdings = [
    { ticker: 'NVDA', name: 'NVIDIA Corporation', weight: 20.0, volatility: 45, beta: 1.8 },
    { ticker: 'MSFT', name: 'Microsoft Corporation', weight: 18.5, volatility: 25, beta: 1.1 },
    { ticker: 'AAPL', name: 'Apple Inc.', weight: 15.0, volatility: 28, beta: 1.2 },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', weight: 12.0, volatility: 30, beta: 1.15 },
    { ticker: 'META', name: 'Meta Platforms', weight: 8.0, volatility: 38, beta: 1.4 },
    { ticker: 'V', name: 'Visa Inc.', weight: 7.0, volatility: 22, beta: 0.95 },
    { ticker: 'JPM', name: 'JPMorgan Chase', weight: 6.5, volatility: 26, beta: 1.1 },
    { ticker: 'UNH', name: 'UnitedHealth Group', weight: 5.0, volatility: 24, beta: 0.85 },
    { ticker: 'AMZN', name: 'Amazon.com', weight: 5.0, volatility: 32, beta: 1.25 },
    { ticker: 'JNJ', name: 'Johnson & Johnson', weight: 3.0, volatility: 18, beta: 0.65 },
  ];

  // Calculate risk contributions (simplified model)
  // Component VaR = weight * marginal VaR
  // Marginal VaR approximated by individual volatility * beta * correlation
  
  const totalWeightedRisk = holdings.reduce((sum, h) => {
    return sum + h.weight * h.volatility * h.beta;
  }, 0);

  return holdings.map((h) => {
    const correlation = 0.5 + Math.random() * 0.4; // 0.5 to 0.9
    const marginalVaR = (h.volatility / 100) * h.beta * correlation * portfolioVaR / 10;
    const componentVaR = (h.weight / 100) * marginalVaR;
    const contributionPct = (h.weight * h.volatility * h.beta) / totalWeightedRisk * 100;

    return {
      ticker: h.ticker,
      name: h.name,
      weight: h.weight,
      volatility: h.volatility,
      beta: h.beta,
      marginalVaR,
      componentVaR,
      contributionPct,
      correlationToPortfolio: correlation,
    };
  }).sort((a, b) => b.contributionPct - a.contributionPct);
}
