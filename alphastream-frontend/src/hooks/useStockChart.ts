import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { API_BASE_URL } from "@/config/api";

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
  // Extended-hours (after/pre market) close, used only to draw the dashed 1D segment
  extendedClose?: number | null;
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

/** Shared EOD cache so Historical Data can reuse bars the chart already loaded. */
export const eodBarCache = new Map<string, RawBar[]>();
export const intradayBarCache = new Map<string, RawBar[]>();

export interface AfterHoursInfo {
  price: number;
  prevClose: number | null;
  change: number | null;
  changePercent: number | null;
  timestamp: number | null;
  session: "pre" | "post";
}

interface UseStockChartReturn {
  data: StockDataPoint[];
  rawIntradayData: StockDataPoint[];
  rawHourlyData: StockDataPoint[];
  rawEodData: StockDataPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  lastUpdated: Date | null;
  avgVolume: number | undefined;
  maPeriod: number;
  afterHours: AfterHoursInfo | null;
}

// Get MA period based on timeframe for appropriate smoothing
function getMAPeriod(timeRange: TimeRange): number {
  switch (timeRange) {
    case "1D":
    case "5D":
      return 20; // 20 periods for intraday (100 minutes with 5-min bars)
    case "1M":
      return 20; // 20 periods for hourly bars (~2.5 trading days)
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

// Local calendar-day key (YYYY-M-D) for a data point, used to group sessions.
function sessionDayKey(point: StockDataPoint): string {
  const d = new Date(point.timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Filter data by time range
function filterByTimeRange(data: StockDataPoint[], timeRange: TimeRange): StockDataPoint[] {
  if (data.length === 0) return data;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1D / 5D anchor to the trading sessions actually present in the data (not the
  // wall clock), so weekends, holidays and pre-open still show the last session(s)
  // instead of rendering blank.
  if (timeRange === "1D" || timeRange === "5D") {
    const distinctDays: string[] = [];
    // data is oldest -> newest; walk backwards to collect the most recent sessions
    for (let i = data.length - 1; i >= 0; i--) {
      const key = sessionDayKey(data[i]);
      if (!distinctDays.includes(key)) {
        distinctDays.push(key);
        if (distinctDays.length >= (timeRange === "1D" ? 1 : 5)) break;
      }
    }
    const keep = new Set(distinctDays);
    return data.filter((d) => keep.has(sessionDayKey(d)));
  }

  let cutoffDate: Date;

  switch (timeRange) {
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

// Determine if timeRange needs intraday (5min) data
function isIntradayTimeRange(timeRange: TimeRange): boolean {
  return timeRange === "1D" || timeRange === "5D";
}

// 1M uses daily EOD (hourly FMP is flaky and blocked the default view).
function getDataSourceForTimeRange(
  timeRange: TimeRange,
  intradayData: StockDataPoint[],
  eodData: StockDataPoint[]
): StockDataPoint[] {
  if (isIntradayTimeRange(timeRange)) return intradayData;
  return eodData;
}

export function chartCacheKey(symbol: string, isIndex: boolean): string {
  return `${isIndex ? "idx:" : ""}${symbol.toUpperCase()}`;
}

export function chartEndpoint(symbol: string, isIndex: boolean, timeframe: string, limit: number): string {
  const encoded = encodeURIComponent(symbol);
  const base = isIndex ? `/api/index/${encoded}/chart` : `/api/stock/${encoded}/chart`;
  return `${API_BASE_URL}${base}?timeframe=${timeframe}&limit=${limit}`;
}

export function useStockChart(
  symbol: string,
  timeRange: TimeRange,
  options?: { isIndex?: boolean }
): UseStockChartReturn {
  const { isMarketOpen } = useMarket();
  const isIndex = options?.isIndex ?? false;

  // Cache for raw data to avoid redundant fetches
  const [intradayData, setIntradayData] = useState<StockDataPoint[]>([]);
  const [hourlyData, setHourlyData] = useState<StockDataPoint[]>([]);
  const [eodData, setEodData] = useState<StockDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [afterHours, setAfterHours] = useState<AfterHoursInfo | null>(null);

  // Track which symbol's data is cached
  const cachedSymbolRef = useRef<string>("");

  // Fetch intraday data (5min bars) - limit to ~5 days (78 bars/day * 5 = 390)
  const fetchIntraday = useCallback(async () => {
    const requestSymbol = symbol;
    const key = chartCacheKey(requestSymbol, isIndex);
    try {
      const cached = intradayBarCache.get(key);
      if (cached && cached.length >= 20) {
        const points = cached.map(rawBarToDataPoint);
        if (cachedSymbolRef.current === requestSymbol) {
          setIntradayData(points);
          setLastUpdated(new Date());
        }
        return points;
      }
      const res = await fetch(chartEndpoint(requestSymbol, isIndex, "5min", 400));
      if (!res.ok) throw new Error(`Failed to fetch intraday data: ${res.status}`);
      const bars: RawBar[] = await res.json();
      intradayBarCache.set(key, bars);
      const points = bars.map(rawBarToDataPoint);
      if (cachedSymbolRef.current === requestSymbol) {
        setIntradayData(points);
        setLastUpdated(new Date());
      }
      return points;
    } catch (err) {
      console.error("Error fetching intraday data:", err);
      throw err;
    }
  }, [symbol, isIndex]);

  // Fetch EOD data (daily bars) - limit to ~5 years (252 * 5 = 1260)
  const fetchEod = useCallback(async () => {
    const requestSymbol = symbol;
    const key = chartCacheKey(requestSymbol, isIndex);
    try {
      const cached = eodBarCache.get(key);
      if (cached && cached.length >= 200) {
        const points = cached.map(rawBarToDataPoint);
        if (cachedSymbolRef.current === requestSymbol) {
          setEodData(points);
          setLastUpdated(new Date());
        }
        return points;
      }
      const res = await fetch(chartEndpoint(requestSymbol, isIndex, "1day", 1300));
      if (!res.ok) throw new Error(`Failed to fetch EOD data: ${res.status}`);
      const bars: RawBar[] = await res.json();
      eodBarCache.set(key, bars);
      const points = bars.map(rawBarToDataPoint);
      if (cachedSymbolRef.current === requestSymbol) {
        setEodData(points);
        setLastUpdated(new Date());
      }
      return points;
    } catch (err) {
      console.error("Error fetching EOD data:", err);
      throw err;
    }
  }, [symbol, isIndex]);

  // Default view is 1M (daily). Only fetch EOD on open — 5min waits until 1D/5D.
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      setIntradayData([]);
      setHourlyData([]);
      setEodData([]);
      cachedSymbolRef.current = symbol;

      try {
        await fetchEod();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chart data");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [symbol, fetchEod]);

  // Lazy-load 5min bars only when the user actually opens 1D or 5D.
  useEffect(() => {
    if (!symbol || !isIntradayTimeRange(timeRange)) return;
    if (intradayData.length > 0) return;
    const cached = intradayBarCache.get(chartCacheKey(symbol, isIndex));
    if (cached && cached.length > 0) {
      setIntradayData(cached.map(rawBarToDataPoint));
      return;
    }
    fetchIntraday().catch(console.error);
  }, [symbol, timeRange, isIndex, fetchIntraday, intradayData.length]);

  // When the market is closed, fetch the latest extended-hours price so the 1D
  // view can show an "After Hours" marker. Cleared while the market is open.
  // Indices have no after-hours tape.
  useEffect(() => {
    if (!symbol || isIndex) {
      setAfterHours(null);
      return;
    }
    if (isMarketOpen) {
      setAfterHours(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${symbol}/aftermarket`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json?.available && typeof json.price === "number") {
          setAfterHours({
            price: json.price,
            prevClose: json.prevClose ?? null,
            change: json.change ?? null,
            changePercent: json.changePercent ?? null,
            timestamp: json.timestamp ?? null,
            session: json.session === "pre" ? "pre" : "post",
          });
        } else {
          setAfterHours(null);
        }
      } catch (err) {
        console.error("Error fetching after-hours data:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, isMarketOpen, isIndex]);

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
        eodBarCache.delete(chartCacheKey(symbol, isIndex));
        await fetchEod();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh chart data");
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeRange, isIndex, fetchIntraday, fetchEod]);

  // Get MA period based on timeframe
  const maPeriod = useMemo(() => getMAPeriod(timeRange), [timeRange]);

  // Compute filtered and processed data
  const data = useMemo(() => {
    // Pick the source with graceful fallbacks so a panel never renders blank:
    // - 1D/5D normally use intraday 5min bars; if that feed is empty, fall back to EOD.
    // - 1M prefers hourly granularity; FMP's hourly feed is often empty, so fall back to EOD.
    let rawData: StockDataPoint[];
    if ((timeRange === "1D" || timeRange === "5D") && intradayData.length === 0) {
      rawData = eodData;
    } else {
      rawData = getDataSourceForTimeRange(timeRange, intradayData, eodData);
    }
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
    rawHourlyData: hourlyData,
    rawEodData: eodData,
    isLoading,
    error,
    refetch,
    lastUpdated,
    avgVolume,
    maPeriod,
    afterHours,
  };
}
