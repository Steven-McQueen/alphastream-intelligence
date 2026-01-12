import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useMarket } from "@/context/MarketContext";

const API_BASE_URL = "http://localhost:8000";

export type TimeRange = "1D" | "5D" | "1M" | "6M" | "1Y" | "YTD" | "5Y";

export interface StockDataPoint {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  price: number; // alias for close
  // Moving averages (calculated client-side)
  sma?: number;
  ema?: number;
  wma?: number;
  dema?: number;
  tema?: number;
}

interface RawBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe?: string;
}

interface UseStockChartReturn {
  data: StockDataPoint[];
  rawIntradayData: StockDataPoint[];
  rawEodData: StockDataPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  lastUpdated: Date | null;
  avgVolume: number | undefined;
  maPeriod: number;
}

// Get MA period based on timeframe for appropriate smoothing
function getMAPeriod(timeRange: TimeRange): number {
  switch (timeRange) {
    case "1D":
    case "5D":
      return 20; // 20 periods for intraday (100 minutes with 5-min bars)
    case "1M":
      return 10; // 10 days for 1 month
    case "6M":
    case "YTD":
      return 20; // 20 days for 6 months/YTD
    case "1Y":
      return 50; // 50 days for 1 year
    case "5Y":
      return 200; // 200 days for 5 years
    default:
      return 20;
  }
}

// Calculate Simple Moving Average
function calculateSMA(prices: number[], period: number): (number | undefined)[] {
  const sma: (number | undefined)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(undefined);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

// Calculate Exponential Moving Average
function calculateEMA(prices: number[], period: number): (number | undefined)[] {
  const ema: (number | undefined)[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(undefined);
    } else if (i === period - 1) {
      // First EMA is SMA
      const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
      ema.push(sum / period);
    } else {
      const prevEma = ema[i - 1];
      if (prevEma !== undefined) {
        ema.push((prices[i] - prevEma) * multiplier + prevEma);
      } else {
        ema.push(undefined);
      }
    }
  }
  return ema;
}

// Calculate Weighted Moving Average
function calculateWMA(prices: number[], period: number): (number | undefined)[] {
  const wma: (number | undefined)[] = [];
  const denominator = (period * (period + 1)) / 2;
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      wma.push(undefined);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - period + 1 + j] * (j + 1);
      }
      wma.push(sum / denominator);
    }
  }
  return wma;
}

// Calculate Double Exponential Moving Average
function calculateDEMA(prices: number[], period: number): (number | undefined)[] {
  const ema1 = calculateEMA(prices, period);
  const ema1Values = ema1.map(v => v ?? 0);
  const ema2 = calculateEMA(ema1Values, period);
  
  return prices.map((_, i) => {
    if (ema1[i] === undefined || ema2[i] === undefined) return undefined;
    return 2 * ema1[i]! - ema2[i]!;
  });
}

// Calculate Triple Exponential Moving Average
function calculateTEMA(prices: number[], period: number): (number | undefined)[] {
  const ema1 = calculateEMA(prices, period);
  const ema1Values = ema1.map(v => v ?? 0);
  const ema2 = calculateEMA(ema1Values, period);
  const ema2Values = ema2.map(v => v ?? 0);
  const ema3 = calculateEMA(ema2Values, period);
  
  return prices.map((_, i) => {
    if (ema1[i] === undefined || ema2[i] === undefined || ema3[i] === undefined) return undefined;
    return 3 * ema1[i]! - 3 * ema2[i]! + ema3[i]!;
  });
}

// Add moving averages to data points
function addMovingAverages(data: StockDataPoint[], period: number = 20): StockDataPoint[] {
  if (data.length === 0) return data;
  
  const prices = data.map(d => d.close);
  const smaValues = calculateSMA(prices, period);
  const emaValues = calculateEMA(prices, period);
  const wmaValues = calculateWMA(prices, period);
  const demaValues = calculateDEMA(prices, period);
  const temaValues = calculateTEMA(prices, period);
  
  return data.map((point, i) => ({
    ...point,
    sma: smaValues[i],
    ema: emaValues[i],
    wma: wmaValues[i],
    dema: demaValues[i],
    tema: temaValues[i],
  }));
}

// Parse date string to timestamp
function parseDate(dateStr: string): number {
  // Handle both "2026-01-08" and "2026-01-08 15:55:00" formats
  return new Date(dateStr).getTime();
}

// Convert raw bar to StockDataPoint
function rawBarToDataPoint(bar: RawBar): StockDataPoint {
  return {
    timestamp: parseDate(bar.date),
    date: bar.date,
    open: bar.open ?? 0,
    high: bar.high ?? 0,
    low: bar.low ?? 0,
    close: bar.close ?? 0,
    volume: bar.volume ?? 0,
    price: bar.close ?? 0,
  };
}

// Filter data by time range
function filterByTimeRange(data: StockDataPoint[], timeRange: TimeRange): StockDataPoint[] {
  if (data.length === 0) return data;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let cutoffDate: Date;
  
  switch (timeRange) {
    case "1D": {
      // For intraday, filter to today's data only
      cutoffDate = today;
      break;
    }
    case "5D": {
      // Last 5 trading days (roughly 7 calendar days to account for weekends)
      cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      break;
    }
    case "1M": {
      cutoffDate = new Date(today);
      cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      break;
    }
    case "6M": {
      cutoffDate = new Date(today);
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      break;
    }
    case "1Y": {
      cutoffDate = new Date(today);
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      break;
    }
    case "YTD": {
      cutoffDate = new Date(now.getFullYear(), 0, 1);
      break;
    }
    case "5Y": {
      // Return all data for 5Y
      return data;
    }
    default:
      return data;
  }
  
  const cutoffTimestamp = cutoffDate.getTime();
  return data.filter(d => d.timestamp >= cutoffTimestamp);
}

// Determine if timeRange needs intraday or EOD data
function isIntradayTimeRange(timeRange: TimeRange): boolean {
  return timeRange === "1D" || timeRange === "5D";
}

export function useStockChart(
  symbol: string,
  timeRange: TimeRange
): UseStockChartReturn {
  const { isMarketOpen } = useMarket();
  
  // Cache for raw data to avoid redundant fetches
  const [intradayData, setIntradayData] = useState<StockDataPoint[]>([]);
  const [eodData, setEodData] = useState<StockDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Track which symbol's data is cached
  const cachedSymbolRef = useRef<string>("");
  
  // Fetch intraday data (5min bars)
  const fetchIntraday = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stock/${symbol}/chart?timeframe=5min&limit=2000`);
      if (!res.ok) throw new Error(`Failed to fetch intraday data: ${res.status}`);
      const bars: RawBar[] = await res.json();
      const points = bars.map(rawBarToDataPoint);
      setIntradayData(points);
      setLastUpdated(new Date());
      return points;
    } catch (err) {
      console.error("Error fetching intraday data:", err);
      throw err;
    }
  }, [symbol]);
  
  // Fetch EOD data (daily bars)
  const fetchEod = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stock/${symbol}/chart?timeframe=1day&limit=2000`);
      if (!res.ok) throw new Error(`Failed to fetch EOD data: ${res.status}`);
      const bars: RawBar[] = await res.json();
      const points = bars.map(rawBarToDataPoint);
      setEodData(points);
      setLastUpdated(new Date());
      return points;
    } catch (err) {
      console.error("Error fetching EOD data:", err);
      throw err;
    }
  }, [symbol]);
  
  // Initial data fetch when symbol changes
  useEffect(() => {
    if (!symbol) return;
    
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // If symbol changed, fetch both datasets
        if (cachedSymbolRef.current !== symbol) {
          await Promise.all([fetchIntraday(), fetchEod()]);
          cachedSymbolRef.current = symbol;
        } else {
          // Symbol same, fetch based on current timeRange needs
          if (isIntradayTimeRange(timeRange) && intradayData.length === 0) {
            await fetchIntraday();
          }
          if (!isIntradayTimeRange(timeRange) && eodData.length === 0) {
            await fetchEod();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chart data");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [symbol]); // Only re-run when symbol changes
  
  // Auto-refresh intraday data every 5 minutes during market hours
  useEffect(() => {
    if (!symbol || !isMarketOpen || !isIntradayTimeRange(timeRange)) return;
    
    const interval = setInterval(() => {
      fetchIntraday().catch(console.error);
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [symbol, isMarketOpen, timeRange, fetchIntraday]);
  
  // Manual refetch function
  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (isIntradayTimeRange(timeRange)) {
        await fetchIntraday();
      } else {
        await fetchEod();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh chart data");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, fetchIntraday, fetchEod]);
  
  // Get MA period based on timeframe
  const maPeriod = useMemo(() => getMAPeriod(timeRange), [timeRange]);

  // Compute filtered and processed data
  const data = useMemo(() => {
    const rawData = isIntradayTimeRange(timeRange) ? intradayData : eodData;
    const filtered = filterByTimeRange(rawData, timeRange);
    return addMovingAverages(filtered, maPeriod);
  }, [timeRange, intradayData, eodData, maPeriod]);

  // Calculate average volume from the filtered data
  const avgVolume = useMemo(() => {
    if (data.length === 0) return undefined;
    const totalVolume = data.reduce((sum, d) => sum + (d.volume || 0), 0);
    return totalVolume / data.length;
  }, [data]);
  
  return {
    data,
    rawIntradayData: intradayData,
    rawEodData: eodData,
    isLoading,
    error,
    refetch,
    lastUpdated,
    avgVolume,
    maPeriod,
  };
}

