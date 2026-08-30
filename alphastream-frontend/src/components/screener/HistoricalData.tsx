import { useState, useEffect, useMemo } from "react";
import { Loader2, Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { eodBarCache, intradayBarCache, chartCacheKey, chartEndpoint } from "@/hooks/useStockChart";

type Timeframe = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y";

interface HistoricalDataProps {
  ticker: string;
  isIndex?: boolean;
}

interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Format date based on interval
function formatDate(dateStr: string, isIntraday: boolean): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isIntraday) {
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Format price
function formatPrice(value: number | null | undefined, asIndexLevel = false): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const n = value.toFixed(2);
  return asIndexLevel ? n : `$${n}`;
}

// Format volume
function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
}

function eodLimitForTimeframe(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1M":
      return 45;
    case "6M":
      return 140;
    case "YTD":
      return 200;
    case "1Y":
      return 270;
    case "5Y":
    default:
      return 1300;
  }
}

function filterBarsByTimeframe(result: PriceBar[], timeframe: Timeframe): PriceBar[] {
  const now = new Date();
  let filtered = result;

  if (timeframe === "1D") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    filtered = result.filter((bar) => new Date(bar.date) >= today);
  } else if (timeframe === "5D") {
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    filtered = result.filter((bar) => new Date(bar.date) >= fiveDaysAgo);
  } else if (timeframe === "1M") {
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    filtered = result.filter((bar) => new Date(bar.date) >= oneMonthAgo);
  } else if (timeframe === "6M") {
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    filtered = result.filter((bar) => new Date(bar.date) >= sixMonthsAgo);
  } else if (timeframe === "YTD") {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    filtered = result.filter((bar) => new Date(bar.date) >= startOfYear);
  } else if (timeframe === "1Y") {
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    filtered = result.filter((bar) => new Date(bar.date) >= oneYearAgo);
  }

  filtered.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return filtered;
}

function getIntervalDescription(timeframe: Timeframe): string {
  if (timeframe === "1D" || timeframe === "5D") return "5 minute interval";
  return "Daily interval";
}

// Calculate daily returns from price data
function calculateDailyReturns(data: PriceBar[]): number[] {
  if (data.length < 2) return [];
  return data.slice(1).map((bar, i) => {
    const prevClose = data[i].close;
    if (!prevClose || prevClose === 0) return 0;
    return ((bar.close - prevClose) / prevClose) * 100;
  });
}

// Calculate statistics
function calculateStatistics(data: PriceBar[], riskFreeRate: number = 2) {
  if (data.length < 2) {
    return { 
      sharpeRatio: 0, sortinoRatio: 0, avgReturn: 0, stdDev: 0, 
      maxDrawdown: 0, avgVolume: 0, volatility: 0, totalReturn: 0,
      bestDay: 0, worstDay: 0, positiveCount: 0, negativeCount: 0
    };
  }

  const returns = calculateDailyReturns(data);
  if (returns.length === 0) {
    return { 
      sharpeRatio: 0, sortinoRatio: 0, avgReturn: 0, stdDev: 0, 
      maxDrawdown: 0, avgVolume: 0, volatility: 0, totalReturn: 0,
      bestDay: 0, worstDay: 0, positiveCount: 0, negativeCount: 0
    };
  }

  // Average return
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Downside deviation (for Sortino)
  const negativeReturns = returns.filter(r => r < 0);
  const downsideVariance = negativeReturns.length > 0 
    ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length 
    : 0;
  const downsideDeviation = Math.sqrt(downsideVariance);
  
  // Annualized values (assuming 252 trading days)
  const annualizedReturn = avgReturn * 252;
  const annualizedStdDev = stdDev * Math.sqrt(252);
  const annualizedDownside = downsideDeviation * Math.sqrt(252);
  
  // Sharpe Ratio = (Return - RiskFreeRate) / StdDev
  const sharpeRatio = annualizedStdDev > 0 ? (annualizedReturn - riskFreeRate) / annualizedStdDev : 0;
  
  // Sortino Ratio = (Return - RiskFreeRate) / DownsideDeviation
  const sortinoRatio = annualizedDownside > 0 ? (annualizedReturn - riskFreeRate) / annualizedDownside : 0;
  
  // Max Drawdown
  let peak = data[0].close;
  let maxDrawdown = 0;
  data.forEach(bar => {
    if (bar.close > peak) peak = bar.close;
    const drawdown = ((peak - bar.close) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });
  
  // Total return
  const totalReturn = data.length >= 2 
    ? ((data[data.length - 1].close - data[0].close) / data[0].close) * 100 
    : 0;
  
  // Average volume
  const avgVolume = data.reduce((sum, bar) => sum + (bar.volume || 0), 0) / data.length;
  
  // Best/Worst day
  const bestDay = Math.max(...returns);
  const worstDay = Math.min(...returns);
  
  // Positive/Negative days
  const positiveCount = returns.filter(r => r > 0).length;
  const negativeCount = returns.filter(r => r < 0).length;
  
  return {
    sharpeRatio,
    sortinoRatio,
    avgReturn: annualizedReturn,
    stdDev: annualizedStdDev,
    maxDrawdown,
    avgVolume,
    volatility: annualizedStdDev,
    totalReturn,
    bestDay,
    worstDay,
    positiveCount,
    negativeCount
  };
}

// Metric card component
function MetricCard({ 
  label, 
  value, 
  format = "number",
  isPositive 
}: { 
  label: string; 
  value: number; 
  format?: "number" | "percent" | "volume" | "ratio";
  isPositive?: boolean;
}) {
  const formatMetric = (v: number) => {
    if (isNaN(v) || !isFinite(v)) return "-";
    switch (format) {
      case "percent":
        return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
      case "volume":
        return formatVolume(v);
      case "ratio":
        return v.toFixed(2);
      default:
        return v.toFixed(2);
    }
  };

  const colorClass = isPositive === undefined 
    ? "text-foreground"
    : isPositive 
      ? "text-positive" 
      : "text-negative";

  return (
    <div className="bg-muted/50 rounded-lg p-3 border border-secondary/50">
      <div className="text-xs text-dim uppercase tracking-wide mb-1">{label}</div>
      <div className={cn("text-lg font-mono font-semibold", colorClass)}>
        {formatMetric(value)}
      </div>
    </div>
  );
}

export function HistoricalData({ ticker, isIndex = false }: HistoricalDataProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [data, setData] = useState<PriceBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const isIntraday = timeframe === "1D" || timeframe === "5D";

  // Fetch data — reuse bars the chart already loaded; otherwise request only
  // as many daily bars as this timeframe needs.
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setPage(0);

      try {
        const key = chartCacheKey(ticker, isIndex);
        let result: PriceBar[] | undefined;

        if (isIntraday) {
          result = intradayBarCache.get(key) as PriceBar[] | undefined;
          if (!result || result.length === 0) {
            const res = await fetch(chartEndpoint(ticker, isIndex, "5min", 400));
            if (!res.ok) throw new Error("Failed to fetch historical data");
            result = await res.json();
            if (result) intradayBarCache.set(key, result);
          }
        } else {
          const needed = eodLimitForTimeframe(timeframe);
          const cached = eodBarCache.get(key);
          if (cached && cached.length >= needed) {
            result = cached as PriceBar[];
          } else {
            const res = await fetch(chartEndpoint(ticker, isIndex, "1day", needed));
            if (!res.ok) throw new Error("Failed to fetch historical data");
            result = await res.json();
            if (result && result.length >= 1000) {
              eodBarCache.set(key, result);
            }
          }
        }

        setData(filterBarsByTimeframe(result || [], timeframe));
      } catch (err) {
        console.error("Error fetching historical data:", err);
        setError("Failed to load historical data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker, timeframe, isIntraday, isIndex]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page]);

  const totalPages = Math.ceil(data.length / pageSize);

  // Download CSV
  const downloadCSV = () => {
    if (!data.length) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Open,High,Low,Close,Volume\n";
    
    data.forEach(bar => {
      csvContent += `${bar.date},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ticker}_historical_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort data chronologically (oldest first) for statistics calculations
  const chronologicalData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  // Calculate statistics using chronologically sorted data
  const stats = useMemo(() => {
    if (!chronologicalData || chronologicalData.length === 0) {
      return { 
        sharpeRatio: 0, sortinoRatio: 0, avgReturn: 0, stdDev: 0, 
        maxDrawdown: 0, avgVolume: 0, volatility: 0, totalReturn: 0,
        bestDay: 0, worstDay: 0, positiveCount: 0, negativeCount: 0
      };
    }
    return calculateStatistics(chronologicalData);
  }, [chronologicalData]);

  // Prepare chart data for returns distribution - MUST be before early returns (React Hooks rule)
  const returnsDistribution = useMemo(() => {
    if (!chronologicalData || chronologicalData.length < 2) return [];
    const returns = calculateDailyReturns(chronologicalData);
    if (returns.length === 0) return [];
    
    // Create histogram buckets
    const buckets: { range: string; count: number; color: string }[] = [];
    const ranges = [
      { min: -Infinity, max: -3, label: "< -3%", color: "#ef4444" },
      { min: -3, max: -2, label: "-3% to -2%", color: "#f87171" },
      { min: -2, max: -1, label: "-2% to -1%", color: "#fca5a5" },
      { min: -1, max: 0, label: "-1% to 0%", color: "#fecaca" },
      { min: 0, max: 1, label: "0% to 1%", color: "#bbf7d0" },
      { min: 1, max: 2, label: "1% to 2%", color: "#86efac" },
      { min: 2, max: 3, label: "2% to 3%", color: "#4ade80" },
      { min: 3, max: Infinity, label: "> 3%", color: "#22c55e" },
    ];
    
    ranges.forEach(range => {
      const count = returns.filter(r => r > range.min && r <= range.max).length;
      buckets.push({ range: range.label, count, color: range.color });
    });
    
    return buckets;
  }, [chronologicalData]);
  
  // Prepare cumulative returns chart data - MUST be before early returns (React Hooks rule)
  const cumulativeReturns = useMemo(() => {
    if (!chronologicalData || chronologicalData.length < 2) return [];
    const basePrice = chronologicalData[0]?.close;
    if (!basePrice || basePrice === 0) return [];
    return chronologicalData.map(bar => ({
      date: new Date(bar.date).getTime(),
      return: ((bar.close - basePrice) / basePrice) * 100,
      close: bar.close
    }));
  }, [chronologicalData]);

  // Unique gradient ID to prevent SVG conflicts when multiple charts are rendered
  const gradientId = `returnGradient-${ticker}`;

  // Early returns MUST come after all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-dim" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-dim">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Panel */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-positive" />
          <h3 className="text-sm font-semibold text-foreground">Performance Metrics</h3>
          <span className="text-xs text-dim ml-2">({timeframe})</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard 
            label="Total Return" 
            value={stats.totalReturn} 
            format="percent" 
            isPositive={stats.totalReturn >= 0} 
          />
          <MetricCard 
            label="Sharpe Ratio" 
            value={stats.sharpeRatio} 
            format="ratio"
            isPositive={stats.sharpeRatio >= 1}
          />
          <MetricCard 
            label="Sortino Ratio" 
            value={stats.sortinoRatio} 
            format="ratio"
            isPositive={stats.sortinoRatio >= 1}
          />
          <MetricCard 
            label="Volatility (Ann.)" 
            value={stats.volatility} 
            format="percent"
          />
          <MetricCard 
            label="Max Drawdown" 
            value={-stats.maxDrawdown} 
            format="percent"
            isPositive={stats.maxDrawdown < 10}
          />
          <MetricCard 
            label="Avg Volume" 
            value={stats.avgVolume} 
            format="volume"
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <MetricCard 
            label="Best Day" 
            value={stats.bestDay} 
            format="percent"
            isPositive={true}
          />
          <MetricCard 
            label="Worst Day" 
            value={stats.worstDay} 
            format="percent"
            isPositive={false}
          />
          <MetricCard 
            label="Up Days" 
            value={stats.positiveCount} 
            format="number"
          />
          <MetricCard 
            label="Down Days" 
            value={stats.negativeCount} 
            format="number"
          />
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative Returns Chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            {stats.totalReturn >= 0 ? (
              <TrendingUp className="w-5 h-5 text-positive" />
            ) : (
              <TrendingDown className="w-5 h-5 text-negative" />
            )}
            <h3 className="text-sm font-semibold text-foreground">Cumulative Returns</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cumulativeReturns} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stats.totalReturn >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={stats.totalReturn >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#27272a" }}
              />
              <YAxis 
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#27272a" }}
                width={45}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--tooltip-bg))", border: "1px solid hsl(var(--tooltip-border-light))", borderRadius: "8px" }}
                labelFormatter={(ts) => new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                formatter={(value: number) => [`${value.toFixed(2)}%`, "Return"]}
              />
              <Area 
                type="monotone" 
                dataKey="return" 
                stroke={stats.totalReturn >= 0 ? "#10b981" : "#ef4444"}
                fill={`url(#${gradientId})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Returns Distribution Chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-semibold text-foreground">Returns Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={returnsDistribution} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis 
                dataKey="range" 
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 9 }}
                axisLine={{ stroke: "#27272a" }}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#27272a" }}
                width={35}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--tooltip-bg))", border: "1px solid hsl(var(--tooltip-border-light))", borderRadius: "8px" }}
                formatter={(value: number) => [value, "Days"]}
              />
              <Bar 
                dataKey="count" 
                fill="#06b6d4"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header Controls */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            {/* Timeframe Tabs */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              {(["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y"] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    timeframe === tf ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
            
            {/* Interval Badge */}
            <span className="text-xs text-dim bg-muted/50 px-3 py-1.5 rounded-lg">
              {getIntervalDescription(timeframe)}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Record Count */}
            <span className="text-xs text-dim">
              {data.length.toLocaleString()} records
            </span>
            
            {/* Download Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCSV}
              disabled={!data.length}
              className="border-secondary hover:bg-muted"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted border-b border-secondary">
              <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Date
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Open
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                High
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Low
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Close
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Volume
              </th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-dim">
                  No data available for this period
                </td>
              </tr>
            ) : (
              paginatedData.map((bar, idx) => {
                const change = bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0;
                const isPositive = change >= 0;
                
                return (
                  <tr 
                    key={bar.date + idx}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-soft">
                      {formatDate(bar.date, isIntraday)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-soft">
                      {formatPrice(bar.open, isIndex)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-positive">
                      {formatPrice(bar.high, isIndex)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-negative">
                      {formatPrice(bar.low, isIndex)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-mono font-medium text-foreground">
                      {formatPrice(bar.close, isIndex)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-muted-foreground">
                      {formatVolume(bar.volume)}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-sm text-right font-mono font-medium",
                      isPositive ? "text-positive" : "text-negative"
                    )}>
                      {isPositive ? "+" : ""}{change.toFixed(2)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-border">
          <span className="text-xs text-dim">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)} of {data.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border-secondary hover:bg-muted"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="border-secondary hover:bg-muted"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
