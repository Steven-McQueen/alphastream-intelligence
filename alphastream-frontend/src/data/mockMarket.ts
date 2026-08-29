import type { 
  MarketState, 
  MarketIndex, 
  MacroIndicator, 
  SectorPerformance,
  MarketRegime,
  MarketStatus,
  Sector,
  MarketNewsItem,
  CryptoPrice
} from '@/types';

// Market indices
const INDICES: MarketIndex[] = [
  { symbol: 'SPX', name: 'S&P 500', value: 5892.45, change: 28.50, changePercent: 0.49 },
  { symbol: 'NDX', name: 'Nasdaq 100', value: 21245.80, change: 156.30, changePercent: 0.74 },
  { symbol: 'DJI', name: 'Dow Jones', value: 43876.20, change: -45.80, changePercent: -0.10 },
  { symbol: 'RUT', name: 'Russell 2000', value: 2345.65, change: 18.90, changePercent: 0.81 },
  { symbol: 'VIX', name: 'VIX', value: 14.25, change: -0.85, changePercent: -5.63 },
];

// Crypto prices
const CRYPTO_PRICES: CryptoPrice[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 98542.30, change24h: 1245.80, changePercent24h: 1.28, marketCap: 1940000000000 },
  { symbol: 'ETH', name: 'Ethereum', price: 3456.78, change24h: -45.20, changePercent24h: -1.29, marketCap: 416000000000 },
  { symbol: 'SOL', name: 'Solana', price: 187.45, change24h: 8.90, changePercent24h: 4.98, marketCap: 88000000000 },
  { symbol: 'XRP', name: 'Ripple', price: 2.34, change24h: 0.12, changePercent24h: 5.41, marketCap: 134000000000 },
  { symbol: 'ADA', name: 'Cardano', price: 0.98, change24h: -0.02, changePercent24h: -2.00, marketCap: 34500000000 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.324, change24h: 0.015, changePercent24h: 4.85, marketCap: 47800000000 },
];

// Macro indicators
const MACRO_INDICATORS: MacroIndicator[] = [
  { name: 'US 10Y Yield', value: 4.28, previousValue: 4.32, change: -0.04, unit: '%', lastUpdated: new Date().toISOString() },
  { name: 'US 2Y Yield', value: 4.18, previousValue: 4.22, change: -0.04, unit: '%', lastUpdated: new Date().toISOString() },
  { name: 'Fed Funds Rate', value: 5.33, previousValue: 5.33, change: 0, unit: '%', lastUpdated: new Date().toISOString() },
  { name: 'CPI YoY', value: 2.9, previousValue: 3.1, change: -0.2, unit: '%', lastUpdated: new Date().toISOString() },
  { name: 'Core PCE YoY', value: 2.6, previousValue: 2.7, change: -0.1, unit: '%', lastUpdated: new Date().toISOString() },
  { name: 'Unemployment', value: 3.7, previousValue: 3.8, change: -0.1, unit: '%', lastUpdated: new Date().toISOString() },
  { name: 'GDP Growth QoQ', value: 3.2, previousValue: 2.8, change: 0.4, unit: '%', lastUpdated: new Date().toISOString() },
  { name: 'DXY (Dollar Index)', value: 103.45, previousValue: 104.20, change: -0.75, unit: '', lastUpdated: new Date().toISOString() },
];

// Sector performance
const SECTORS: Sector[] = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Energy',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
];

function generateSectorPerformance(): SectorPerformance[] {
  return SECTORS.map((sector) => ({
    sector,
    change1D: Math.round((Math.random() * 4 - 1.5) * 100) / 100,
    change1W: Math.round((Math.random() * 6 - 2) * 100) / 100,
    change1M: Math.round((Math.random() * 10 - 3) * 100) / 100,
    change1Y: Math.round((Math.random() * 40 - 5) * 100) / 100,
  }));
}

// Determine current market status based on time
function getMarketStatus(): MarketStatus {
  const now = new Date();
  const nyHour = now.getUTCHours() - 5; // EST approximation
  const day = now.getUTCDay();
  
  // Weekend
  if (day === 0 || day === 6) return 'Closed';
  
  // Pre-market: 4am-9:30am EST
  if (nyHour >= 4 && nyHour < 9.5) return 'Pre-Market';
  
  // Regular: 9:30am-4pm EST
  if (nyHour >= 9.5 && nyHour < 16) return 'Open';
  
  // After-hours: 4pm-8pm EST
  if (nyHour >= 16 && nyHour < 20) return 'After-Hours';
  
  return 'Closed';
}

// Determine regime based on indicators
function getMarketRegime(): { regime: MarketRegime; probabilities: { riskOn: number; riskOff: number; neutral: number } } {
  // Simulated regime probabilities
  const riskOn = 0.55;
  const riskOff = 0.25;
  const neutral = 0.20;
  
  let regime: MarketRegime = 'Neutral';
  if (riskOn > riskOff && riskOn > neutral) regime = 'Risk-On';
  else if (riskOff > riskOn && riskOff > neutral) regime = 'Risk-Off';
  
  return {
    regime,
    probabilities: { riskOn, riskOff, neutral },
  };
}

export function generateMockMarketState(): MarketState {
  const { regime, probabilities } = getMarketRegime();
  
  return {
    status: getMarketStatus(),
    regime,
    regimeProbabilities: probabilities,
    indices: INDICES,
    cryptoPrices: CRYPTO_PRICES,
    macroIndicators: MACRO_INDICATORS,
    sectorPerformance: generateSectorPerformance(),
    lastUpdated: new Date().toISOString(),
  };
}

// Singleton cache
let marketStateCache: MarketState | null = null;

export function getMockMarketState(): MarketState {
  if (!marketStateCache) {
    marketStateCache = generateMockMarketState();
  }
  return marketStateCache;
}

// Get specific index
export function getIndex(symbol: string): MarketIndex | undefined {
  return getMockMarketState().indices.find((i) => i.symbol === symbol);
}

// Get key indicators for top bar
export function getKeyIndicators(): MarketIndex[] {
  const state = getMockMarketState();
  return state.indices.filter((i) => ['SPX', 'NDX', 'VIX'].includes(i.symbol));
}

// Intraday data point for sparkline charts
export interface IntradayPoint {
  time: string;
  value: number;
}

// Generate intraday sparkline data for an index
export function getIndexIntradayData(symbol: string): IntradayPoint[] {
  const points: IntradayPoint[] = [];
  const index = INDICES.find(i => i.symbol === symbol);
  if (!index) return points;
  
  const currentValue = index.value;
  const changePercent = index.changePercent;
  
  // Calculate opening value based on current change
  const openValue = currentValue / (1 + changePercent / 100);
  
  // Generate points for trading hours (9:30 AM to current time or 4 PM)
  const now = new Date();
  const marketOpen = new Date(now);
  marketOpen.setHours(9, 30, 0, 0);
  
  const marketClose = new Date(now);
  marketClose.setHours(16, 0, 0, 0);
  
  const endTime = now < marketClose ? now : marketClose;
  const totalMinutes = Math.max(30, Math.floor((endTime.getTime() - marketOpen.getTime()) / (1000 * 60)));
  const interval = 15; // 15-minute intervals
  const numPoints = Math.floor(totalMinutes / interval) + 1;
  
  // Create a realistic intraday pattern
  let prevValue = openValue;
  const trend = (currentValue - openValue) / numPoints;
  
  for (let i = 0; i < numPoints; i++) {
    const time = new Date(marketOpen.getTime() + i * interval * 60 * 1000);
    const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Add noise but trend toward current value
    const noise = (Math.random() - 0.5) * openValue * 0.002;
    const targetProgress = i / (numPoints - 1);
    const targetValue = openValue + (currentValue - openValue) * targetProgress;
    
    // Smooth transition with some randomness
    prevValue = prevValue * 0.7 + targetValue * 0.3 + noise;
    
    points.push({
      time: timeStr,
      value: Math.round(prevValue * 100) / 100,
    });
  }
  
  // Ensure last point is current value
  if (points.length > 0) {
    points[points.length - 1].value = currentValue;
  }
  
  return points;
}

// Macro time series (for charts)
export interface MacroTimePoint {
  date: string;
  value: number;
}

export function getMacroTimeSeries(indicator: string, months: number = 12): MacroTimePoint[] {
  const points: MacroTimePoint[] = [];
  const now = new Date();
  
  // Generate historical data points
  for (let i = months; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    
    // Base value with some trend and noise
    let baseValue = 0;
    switch (indicator) {
      case 'US 10Y Yield':
        baseValue = 3.5 + (months - i) * 0.06 + (Math.random() - 0.5) * 0.3;
        break;
      case 'CPI YoY':
        baseValue = 6.5 - (months - i) * 0.3 + (Math.random() - 0.5) * 0.2;
        break;
      case 'VIX':
        baseValue = 18 + (Math.random() - 0.5) * 8;
        break;
      default:
        baseValue = 100 + (Math.random() - 0.5) * 10;
    }
    
    points.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(baseValue * 100) / 100,
    });
  }
  
  return points;
}

// Market News Templates for generating dynamic news
const NEWS_TEMPLATES: Omit<MarketNewsItem, 'id' | 'publishedAt'>[] = [
  {
    headline: 'Fed Officials Signal Patience on Rate Cuts Amid Sticky Inflation',
    summary: 'Federal Reserve officials indicated they are in no rush to lower interest rates, emphasizing the need for more confidence that inflation is sustainably moving toward the 2% target.',
    source: 'Reuters',
    category: 'fed',
    sentiment: 'neutral',
  },
  {
    headline: 'Tech Giants Drive S&P 500 to New All-Time High',
    summary: 'The S&P 500 reached a record close as technology stocks rallied on strong earnings reports from semiconductor and cloud computing companies.',
    source: 'Bloomberg',
    category: 'sector',
    sentiment: 'bullish',
    tickers: ['NVDA', 'MSFT', 'GOOGL'],
  },
  {
    headline: 'Oil Prices Surge on Middle East Supply Concerns',
    summary: 'Crude oil jumped over 2% as escalating tensions in the Middle East raised concerns about potential supply disruptions from the region.',
    source: 'CNBC',
    category: 'geopolitical',
    sentiment: 'bearish',
    tickers: ['XOM', 'CVX'],
  },
  {
    headline: 'Consumer Confidence Beats Expectations in December',
    summary: 'The Conference Board\'s consumer confidence index rose to 115.2, exceeding analyst expectations and signaling resilient household spending.',
    source: 'MarketWatch',
    category: 'macro',
    sentiment: 'bullish',
  },
  {
    headline: 'Apple Announces Record Holiday Quarter Revenue',
    summary: 'Apple reported better-than-expected holiday quarter results, driven by strong iPhone 15 sales and growing services revenue.',
    source: 'WSJ',
    category: 'earnings',
    sentiment: 'bullish',
    tickers: ['AAPL'],
  },
  {
    headline: 'Treasury Yields Decline as Bond Demand Picks Up',
    summary: 'U.S. Treasury yields fell as investors sought safety ahead of key economic data releases, with the 10-year yield dropping 4 basis points.',
    source: 'Financial Times',
    category: 'macro',
    sentiment: 'neutral',
  },
  {
    headline: 'Semiconductor Stocks Rally on AI Demand Surge',
    summary: 'Chip makers saw significant gains as data center operators announced expanded AI infrastructure spending plans for the coming year.',
    source: 'Reuters',
    category: 'sector',
    sentiment: 'bullish',
    tickers: ['NVDA', 'AMD', 'AVGO'],
  },
  {
    headline: 'European Markets Close Lower on Trade Concerns',
    summary: 'European equities ended the session in the red amid renewed concerns about potential tariff escalations affecting global trade.',
    source: 'Bloomberg',
    category: 'geopolitical',
    sentiment: 'bearish',
  },
  {
    headline: 'Retail Sales Data Shows Resilient Consumer Spending',
    summary: 'November retail sales came in stronger than expected, suggesting consumers remain willing to spend despite elevated interest rates.',
    source: 'CNBC',
    category: 'macro',
    sentiment: 'bullish',
  },
  {
    headline: 'Bank Earnings Beat Estimates on Trading Revenue',
    summary: 'Major banks reported quarterly results that exceeded analyst expectations, boosted by strong fixed income trading activity.',
    source: 'WSJ',
    category: 'earnings',
    sentiment: 'bullish',
    tickers: ['JPM', 'GS', 'MS'],
  },
  {
    headline: 'Housing Starts Fall Below Forecast',
    summary: 'New home construction declined more than anticipated as builders face ongoing challenges from elevated mortgage rates and labor costs.',
    source: 'MarketWatch',
    category: 'macro',
    sentiment: 'bearish',
  },
  {
    headline: 'Dollar Weakens Against Major Currencies',
    summary: 'The U.S. dollar index fell as traders adjusted rate cut expectations following softer-than-expected inflation data.',
    source: 'Financial Times',
    category: 'macro',
    sentiment: 'neutral',
  },
];

let newsIdCounter = 0;

export function getMockMarketNews(): MarketNewsItem[] {
  const now = Date.now();
  return NEWS_TEMPLATES.slice(0, 6).map((template, index) => ({
    ...template,
    id: `news-${++newsIdCounter}`,
    publishedAt: new Date(now - index * 1000 * 60 * 30).toISOString(),
  }));
}

// Generate a new random news item
export function generateNewNewsItem(): MarketNewsItem {
  const randomIndex = Math.floor(Math.random() * NEWS_TEMPLATES.length);
  const template = NEWS_TEMPLATES[randomIndex];
  
  return {
    ...template,
    id: `news-${++newsIdCounter}-${Date.now()}`,
    publishedAt: new Date().toISOString(),
  };
}

// Index detail data for deep dive view
export interface IndexDetailData {
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  high52w: number;
  low52w: number;
  volume: number;
  avgVolume: number;
  ytdReturn: number;
  return1y: number;
}

export function getIndexDetailData(symbol: string): IndexDetailData | null {
  const index = INDICES.find(i => i.symbol === symbol);
  if (!index) return null;

  const currentValue = index.value;
  const changePercent = index.changePercent;
  const openValue = currentValue / (1 + changePercent / 100);

  // Generate realistic data based on the index
  const volatility = symbol === 'VIX' ? 0.15 : 0.02;
  const dayRange = currentValue * volatility;
  
  return {
    previousClose: Math.round((currentValue - index.change) * 100) / 100,
    open: Math.round(openValue * 100) / 100,
    dayHigh: Math.round((Math.max(currentValue, openValue) + dayRange * 0.3) * 100) / 100,
    dayLow: Math.round((Math.min(currentValue, openValue) - dayRange * 0.3) * 100) / 100,
    high52w: Math.round(currentValue * (symbol === 'VIX' ? 4.5 : 1.15) * 100) / 100,
    low52w: Math.round(currentValue * (symbol === 'VIX' ? 0.85 : 0.82) * 100) / 100,
    volume: symbol === 'VIX' ? 0 : Math.floor(Math.random() * 500000000) + 100000000,
    avgVolume: symbol === 'VIX' ? 0 : Math.floor(Math.random() * 400000000) + 150000000,
    ytdReturn: symbol === 'VIX' ? -12.5 : Math.round((Math.random() * 30 - 5) * 100) / 100,
    return1y: symbol === 'VIX' ? -18.2 : Math.round((Math.random() * 35 - 2) * 100) / 100,
  };
}

// Get news related to a specific index
export function getIndexNews(symbol: string): MarketNewsItem[] {
  const now = Date.now();
  
  // Filter and generate news based on index type
  let relevantNews = NEWS_TEMPLATES.filter(template => {
    if (symbol === 'SPX' || symbol === 'NDX' || symbol === 'DJI') {
      return ['macro', 'earnings', 'sector', 'fed'].includes(template.category);
    }
    if (symbol === 'VIX') {
      return ['macro', 'geopolitical', 'fed'].includes(template.category);
    }
    if (symbol === 'RUT') {
      return ['macro', 'earnings', 'sector'].includes(template.category);
    }
    return true;
  });

  return relevantNews.slice(0, 5).map((template, index) => ({
    ...template,
    id: `index-news-${symbol}-${++newsIdCounter}`,
    publishedAt: new Date(now - index * 1000 * 60 * 45).toISOString(),
  }));
}
