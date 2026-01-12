import { useState, useMemo, useRef, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { Loader2, Camera, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import html2canvas from "html2canvas";

const API_BASE_URL = "http://localhost:8000";

type TimeRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y";

interface WatchlistChartProps {
  tickers: string[];
  maxStocks?: number;
}

interface ChartDataPoint {
  date: string;
  timestamp: number;
  [ticker: string]: number | string;
}

interface PriceBar {
  date: string;
  close: number;
}

// Colors for different stocks
const STOCK_COLORS = [
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#3b82f6", // blue
  "#84cc16", // lime
];

// Format date for axis
const formatAxisDate = (timestamp: number, timeRange: TimeRange): string => {
  const date = new Date(timestamp);
  if (timeRange === "1D") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (timeRange === "5D") {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else if (timeRange === "1M") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
};

// Format tooltip date
const formatTooltipDate = (timestamp: number, timeRange: TimeRange): string => {
  const date = new Date(timestamp);
  if (timeRange === "1D" || timeRange === "5D") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label, timeRange }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 shadow-xl backdrop-blur-sm">
      <p className="text-xs text-zinc-400 mb-2">{formatTooltipDate(label, timeRange)}</p>
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs font-medium text-zinc-300">{entry.dataKey}</span>
            </div>
            <span
              className={cn(
                "text-xs font-mono font-medium",
                entry.value >= 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {entry.value >= 0 ? "+" : ""}{entry.value?.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function WatchlistChart({ tickers, maxStocks = 8 }: WatchlistChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Limit to maxStocks
  const activeTickers = useMemo(() => {
    return tickers.slice(0, maxStocks);
  }, [tickers, maxStocks]);

  // Fetch data for all tickers
  useEffect(() => {
    const fetchData = async () => {
      if (activeTickers.length === 0) {
        setChartData([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const isIntraday = timeRange === "1D" || timeRange === "5D";
        const interval = isIntraday ? "5min" : "1day";

        // Fetch data for each ticker in parallel
        // Use limit=2000 for EOD data to ensure we have enough for 5Y timeframe (~1260 trading days)
        const limit = isIntraday ? 500 : 2000;
        const fetchPromises = activeTickers.map(async (ticker) => {
          const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/chart?timeframe=${interval}&limit=${limit}`);
          if (!res.ok) return { ticker, data: [] };
          const data = await res.json();
          return { ticker, data: data as PriceBar[] };
        });

        const results = await Promise.all(fetchPromises);

        // Filter based on timeframe
        const now = new Date();
        const filterByTimeframe = (bars: PriceBar[]): PriceBar[] => {
          if (timeRange === "1D") {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return bars.filter((bar) => new Date(bar.date) >= today);
          } else if (timeRange === "5D") {
            const fiveDaysAgo = new Date(now);
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
            return bars.filter((bar) => new Date(bar.date) >= fiveDaysAgo);
          } else if (timeRange === "1M") {
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            return bars.filter((bar) => new Date(bar.date) >= oneMonthAgo);
          } else if (timeRange === "6M") {
            const sixMonthsAgo = new Date(now);
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return bars.filter((bar) => new Date(bar.date) >= sixMonthsAgo);
          } else if (timeRange === "YTD") {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return bars.filter((bar) => new Date(bar.date) >= startOfYear);
          } else if (timeRange === "1Y") {
            const oneYearAgo = new Date(now);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return bars.filter((bar) => new Date(bar.date) >= oneYearAgo);
          }
          // 5Y uses all data
          return bars;
        };

        // Process each ticker's data and normalize to returns
        const tickerDataMap: Record<string, { date: string; return: number }[]> = {};
        const allDates = new Set<string>();

        results.forEach(({ ticker, data }) => {
          const filtered = filterByTimeframe(data);
          if (filtered.length === 0) return;

          // Sort by date ascending
          filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const basePrice = filtered[0].close;
          if (!basePrice || basePrice === 0) return;

          tickerDataMap[ticker] = filtered.map((bar) => {
            allDates.add(bar.date);
            return {
              date: bar.date,
              return: ((bar.close - basePrice) / basePrice) * 100,
            };
          });
        });

        // Create combined chart data
        const sortedDates = Array.from(allDates).sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );

        const combined: ChartDataPoint[] = sortedDates.map((date) => {
          const point: ChartDataPoint = {
            date,
            timestamp: new Date(date).getTime(),
          };

          Object.entries(tickerDataMap).forEach(([ticker, data]) => {
            const match = data.find((d) => d.date === date);
            if (match) {
              point[ticker] = Number(match.return.toFixed(2));
            }
          });

          return point;
        });

        setChartData(combined);
        setSelectedTickers(Object.keys(tickerDataMap));
      } catch (err) {
        console.error("Error fetching watchlist chart data:", err);
        setError("Failed to load chart data");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchData();
  }, [activeTickers, timeRange]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger re-fetch by changing a state that's in the dependency array
    setTimeRange((prev) => prev);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Handle screenshot
  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;
    try {
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: "#18181b",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `watchlist-chart-${timeRange}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
    }
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Y-axis domain calculation
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [-5, 5];

    let min = 0;
    let max = 0;

    chartData.forEach((point) => {
      selectedTickers.forEach((ticker) => {
        const val = point[ticker] as number;
        if (typeof val === "number") {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      });
    });

    const padding = Math.max(Math.abs(max - min) * 0.1, 1);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData, selectedTickers]);

  if (activeTickers.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-center h-64 text-zinc-500">
          <p>Add stocks to your watchlist to see the comparison chart</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className={cn(
        "bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all duration-300",
        isFullscreen && "fixed inset-4 z-50"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">Performance Comparison</h3>
          <span className="text-xs text-zinc-500">(Normalized to 0% at start)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframe buttons */}
          {(["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                timeRange === range
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
              )}
            >
              {range}
            </button>
          ))}
          
          <div className="h-4 w-px bg-zinc-700 mx-2" />
          
          {/* Action buttons */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
          <button
            onClick={handleScreenshot}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
            title="Screenshot"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center text-red-400">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-zinc-500">
            No data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={isFullscreen ? 500 : 320}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts) => formatAxisDate(ts, timeRange)}
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={{ stroke: "#27272a" }}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => `${v}%`}
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={{ stroke: "#27272a" }}
                width={50}
              />
              {/* Zero line */}
              <CartesianGrid
                strokeDasharray="0"
                horizontalCoordinatesGenerator={() => [0]}
                stroke="#52525b"
              />
              <Tooltip content={<CustomTooltip timeRange={timeRange} />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-zinc-400">{value}</span>
                )}
              />
              {selectedTickers.map((ticker, idx) => (
                <Line
                  key={ticker}
                  type="monotone"
                  dataKey={ticker}
                  stroke={STOCK_COLORS[idx % STOCK_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
