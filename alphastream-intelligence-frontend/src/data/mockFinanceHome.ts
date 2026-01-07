import type { MarketIndex, MacroIndicator, SectorPerformance, MarketNewsItem } from '@/types';
import { getMockMarketState, getMockMarketNews } from './mockMarket';
import { getMockPortfolio } from './mockPortfolio';
import { getStockByTicker, getMockStocks } from './mockStocks';

// Types for Finance Home
export interface TodaySummary {
  narrative: string[];
  marketSentiment: 'Risk-On' | 'Neutral' | 'Risk-Off';
  riskOnProbability: number;
  date: string;
}

export interface TopMover {
  ticker: string;
  name: string;
  sector: string;
  change1D: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
}

export interface EarningsHighlight {
  ticker: string;
  company: string;
  date: string;
  timing: 'BMO' | 'AMC';
  expectedEPS: number;
  lastSurprise: number;
  tag: 'Key Watch' | 'High IV' | 'Growth' | 'Value' | 'Dividend';
}

export interface StandoutStock {
  ticker: string;
  name: string;
  tags: string[];
  explanation: string;
  sparklineData: number[];
}

export interface ScreenerPreviewItem {
  ticker: string;
  change1D: number;
  change1W: number;
  sector: string;
  sentimentScore: number;
}

export interface ThemeTile {
  id: string;
  title: string;
  description: string;
  type: 'Sector' | 'Theme';
  screenCriteria: string;
  prompt: string;
}

export interface TaskAlert {
  id: string;
  title: string;
  status: 'Planned' | 'Active' | 'Mock';
}

// Get today's summary based on market data
export function getTodaySummary(): TodaySummary {
  const state = getMockMarketState();
  const spx = state.indices.find(i => i.symbol === 'SPX');
  const ndx = state.indices.find(i => i.symbol === 'NDX');
  const vix = state.indices.find(i => i.symbol === 'VIX');
  const us10y = state.macroIndicators.find(i => i.name === 'US 10Y Yield');
  
  const topSector = [...state.sectorPerformance].sort((a, b) => b.change1D - a.change1D)[0];
  const worstSector = [...state.sectorPerformance].sort((a, b) => a.change1D - b.change1D)[0];
  
  const narrative: string[] = [];
  
  if (spx) {
    const direction = spx.changePercent >= 0 ? 'gained' : 'lost';
    narrative.push(`S&P 500 ${direction} ${Math.abs(spx.changePercent).toFixed(2)}%, led by ${topSector.sector.toLowerCase()} and communication services.`);
  }
  
  if (us10y) {
    const bps = Math.round(us10y.change * 100);
    const direction = bps >= 0 ? 'rose' : 'fell';
    narrative.push(`US 10Y ${direction} ${Math.abs(bps)} bps after softer-than-expected inflation print.`);
  }
  
  if (vix) {
    if (vix.value < 15) {
      narrative.push(`VIX dropped below 15, signaling easing volatility.`);
    } else if (vix.value > 20) {
      narrative.push(`VIX elevated above 20, indicating heightened market anxiety.`);
    } else {
      narrative.push(`VIX stable at ${vix.value.toFixed(1)}, reflecting neutral volatility expectations.`);
    }
  }
  
  if (worstSector.change1D < -1) {
    narrative.push(`${worstSector.sector} under pressure, down ${Math.abs(worstSector.change1D).toFixed(1)}% on sector rotation.`);
  }
  
  return {
    narrative,
    marketSentiment: state.regime,
    riskOnProbability: state.regimeProbabilities.riskOn,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

// Get market indices with sparkline data
export function getIndexTiles(): (MarketIndex & { sparkline: number[] })[] {
  const state = getMockMarketState();
  return state.indices.slice(0, 4).map(index => ({
    ...index,
    sparkline: generateSparkline(index.value, index.changePercent),
  }));
}

// Get macro indicators
export function getMacroTiles(): MacroIndicator[] {
  const state = getMockMarketState();
  return state.macroIndicators.filter(i => 
    ['US 10Y Yield', 'US 2Y Yield', 'Fed Funds Rate', 'CPI YoY', 'VIX'].includes(i.name) ||
    i.name.includes('VIX')
  ).slice(0, 5);
}

// Get sector performance
export function getSectorTiles(period: '1D' | '1W' | '1M' = '1D'): SectorPerformance[] {
  const state = getMockMarketState();
  return state.sectorPerformance;
}

// Get top movers
export function getTopMovers(type: 'gainers' | 'losers' | 'volume' = 'gainers'): TopMover[] {
  const stocks = getMockStocks();
  
  let sorted = [...stocks];
  
  if (type === 'gainers') {
    sorted = sorted.sort((a, b) => b.change1D - a.change1D).slice(0, 8);
  } else if (type === 'losers') {
    sorted = sorted.sort((a, b) => a.change1D - b.change1D).slice(0, 8);
  } else {
    // Volume - sort by random volume ratio for mock
    sorted = sorted.map(s => ({ ...s, volumeRatio: 0.5 + Math.random() * 3 }))
      .sort((a, b) => (b as any).volumeRatio - (a as any).volumeRatio)
      .slice(0, 8);
  }
  
  return sorted.map(stock => ({
    ticker: stock.ticker,
    name: stock.name,
    sector: stock.sector,
    change1D: stock.change1D,
    volume: Math.floor(Math.random() * 50000000) + 1000000,
    avgVolume: Math.floor(Math.random() * 30000000) + 1000000,
    volumeRatio: 0.5 + Math.random() * 3,
  }));
}

// Get earnings highlights
export function getEarningsHighlights(filter: 'upcoming' | 'recent' = 'upcoming'): EarningsHighlight[] {
  const tickers = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'JPM', 'V', 'UNH'];
  const tags: EarningsHighlight['tag'][] = ['Key Watch', 'High IV', 'Growth', 'Value', 'Dividend'];
  
  const today = new Date();
  
  return tickers.slice(0, 8).map((ticker, i) => {
    const stock = getStockByTicker(ticker);
    const date = new Date(today);
    date.setDate(date.getDate() + (filter === 'upcoming' ? i + 1 : -(i + 1)));
    
    return {
      ticker,
      company: stock?.name || ticker,
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timing: i % 2 === 0 ? 'BMO' : 'AMC',
      expectedEPS: Math.round((1 + Math.random() * 5) * 100) / 100,
      lastSurprise: Math.round((Math.random() * 20 - 5) * 100) / 100,
      tag: tags[i % tags.length],
    };
  });
}

// Get notable standouts
export function getStandouts(): StandoutStock[] {
  const standoutData = [
    { ticker: 'NVDA', tags: ['52-Week High', 'AI Leader'], explanation: 'Continued AI infrastructure demand driving new highs.' },
    { ticker: 'LLY', tags: ['Earnings Beat', 'Healthcare'], explanation: 'GLP-1 drug sales exceeded expectations by 15%.' },
    { ticker: 'COST', tags: ['Heavy Insider Buying'], explanation: 'Three executives purchased $2M+ in shares last week.' },
    { ticker: 'AVGO', tags: ['Momentum Breakout'], explanation: 'Technical breakout above 200-day MA with volume.' },
    { ticker: 'META', tags: ['Analyst Upgrade', 'Growth'], explanation: 'Morgan Stanley raises PT citing AI monetization.' },
    { ticker: 'XOM', tags: ['Dividend Increase'], explanation: 'Announced 5% dividend increase, 41st consecutive year.' },
  ];
  
  return standoutData.map(item => {
    const stock = getStockByTicker(item.ticker);
    return {
      ticker: item.ticker,
      name: stock?.name || item.ticker,
      tags: item.tags,
      explanation: item.explanation,
      sparklineData: generateSparkline(stock?.price || 100, stock?.change1M || 5),
    };
  });
}

// Get screener preview
export function getScreenerPreview(): ScreenerPreviewItem[] {
  const portfolio = getMockPortfolio();
  
  return portfolio.holdings.slice(0, 10).map(holding => {
    const stock = getStockByTicker(holding.ticker);
    return {
      ticker: holding.ticker,
      change1D: holding.dailyPnLPercent,
      change1W: stock?.change1W || 0,
      sector: holding.sector,
      sentimentScore: Math.round(50 + Math.random() * 40),
    };
  });
}

// Get themes
export function getThemes(): ThemeTile[] {
  return [
    {
      id: 'us-tech',
      title: 'US Tech – Quality Compounders',
      description: 'High-ROIC technology leaders with durable competitive advantages.',
      type: 'Sector',
      screenCriteria: 'ROIC > 20%, FCF Yield > 3%',
      prompt: 'Find undervalued quality growth stocks in US technology, with positive fundamental momentum and reasonable valuation.',
    },
    {
      id: 'healthcare',
      title: 'Healthcare – Defensive Growth',
      description: 'Recession-resistant healthcare names with steady earnings growth.',
      type: 'Sector',
      screenCriteria: 'EPS Growth > 10%, Beta < 1',
      prompt: 'Identify defensive healthcare stocks with consistent earnings growth and lower market beta for portfolio stability.',
    },
    {
      id: 'energy',
      title: 'Energy – Beneficiaries of Higher Oil',
      description: 'Integrated majors and E&P companies with strong cash generation.',
      type: 'Sector',
      screenCriteria: 'FCF Yield > 8%, Dividend > 3%',
      prompt: 'Find energy stocks that benefit from elevated oil prices with strong free cash flow and dividend potential.',
    },
    {
      id: 'ai-infra',
      title: 'AI Infrastructure – Picks & Shovels',
      description: 'Semiconductor and cloud infrastructure enabling AI growth.',
      type: 'Theme',
      screenCriteria: 'Revenue Growth > 20%',
      prompt: 'Identify AI infrastructure stocks (semiconductors, data centers, cloud) with strong revenue growth and margin expansion.',
    },
    {
      id: 'quality-dividend',
      title: 'Quality Dividend Growers',
      description: 'Companies with 10+ years of dividend increases and strong balance sheets.',
      type: 'Theme',
      screenCriteria: 'Dividend Growth > 5yr, Debt/Equity < 1',
      prompt: 'Find quality dividend growth stocks with long track records of dividend increases and healthy balance sheets.',
    },
    {
      id: 'small-cap-value',
      title: 'Small Cap Value – Hidden Gems',
      description: 'Undervalued small caps with improving fundamentals.',
      type: 'Theme',
      screenCriteria: 'P/E < 15, Market Cap < $10B',
      prompt: 'Screen for undervalued small cap stocks with improving earnings revisions and potential for multiple expansion.',
    },
  ];
}

// Get tasks/alerts
export function getTasksAlerts(): TaskAlert[] {
  return [
    { id: '1', title: 'Weekly risk review of my portfolio – every Monday.', status: 'Planned' },
    { id: '2', title: 'Alert me if any screener stock drops more than 5% intraday.', status: 'Mock' },
    { id: '3', title: 'Notify me on unusual volume in my quality growth basket.', status: 'Mock' },
    { id: '4', title: 'Summarize earnings for portfolio holdings quarterly.', status: 'Planned' },
    { id: '5', title: 'Track insider buying in technology sector.', status: 'Mock' },
  ];
}

// Helper: Generate sparkline data
function generateSparkline(currentValue: number, changePercent: number): number[] {
  const points: number[] = [];
  const startValue = currentValue / (1 + changePercent / 100);
  const numPoints = 20;
  
  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    const trend = startValue + (currentValue - startValue) * progress;
    const noise = trend * (Math.random() - 0.5) * 0.02;
    points.push(trend + noise);
  }
  
  points[points.length - 1] = currentValue;
  return points;
}

// Get suggested prompts for hero
export function getSuggestedPrompts(): { text: string; prompt: string }[] {
  return [
    { text: 'What moved markets today?', prompt: 'Give me a detailed recap of today\'s US market moves and what drove the major indices.' },
    { text: 'Show quality growth stocks under pressure', prompt: 'Find high-quality growth stocks that are currently under selling pressure but have strong fundamentals.' },
    { text: 'Summarize today\'s earnings highlights', prompt: 'Summarize the most important earnings reports from today and their market impact.' },
    { text: 'Find undervalued tech stocks', prompt: 'Screen for undervalued technology stocks with strong free cash flow and reasonable valuations.' },
  ];
}
