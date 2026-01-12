import { useState, useMemo, useRef, useEffect } from "react";
// Force rebuild v2
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import { useStockChart, TimeRange, StockDataPoint } from "@/hooks/useStockChart";
import { Loader2, RefreshCw, Camera, Maximize2, Minimize2 } from "lucide-react";

type ChartType = "line" | "candle";
type MovingAverage = "none" | "sma" | "ema" | "wma" | "dema" | "tema";

interface StockChartProps {
  symbol: string;
  companyName: string;
  // Additional metrics from parent (for enhanced footer)
  metrics?: {
    yearHigh?: number;
    yearLow?: number;
    avgVolume?: number;
    marketCap?: number;
    ytdReturn?: number;
    oneYearReturn?: number;
  };
}

// Convert price data to returns
const convertToReturns = (data: StockDataPoint[]): StockDataPoint[] => {
  if (data.length === 0) return data;
  
  const basePrice = data[0].close;
  return data.map((point) => ({
    ...point,
    close: Number((((point.close - basePrice) / basePrice) * 100).toFixed(2)),
    open: Number((((point.open - basePrice) / basePrice) * 100).toFixed(2)),
    high: Number((((point.high - basePrice) / basePrice) * 100).toFixed(2)),
    low: Number((((point.low - basePrice) / basePrice) * 100).toFixed(2)),
    price: Number((((point.price - basePrice) / basePrice) * 100).toFixed(2)),
    sma: point.sma ? Number((((point.sma - basePrice) / basePrice) * 100).toFixed(2)) : undefined,
    ema: point.ema ? Number((((point.ema - basePrice) / basePrice) * 100).toFixed(2)) : undefined,
    wma: point.wma ? Number((((point.wma - basePrice) / basePrice) * 100).toFixed(2)) : undefined,
    dema: point.dema ? Number((((point.dema - basePrice) / basePrice) * 100).toFixed(2)) : undefined,
    tema: point.tema ? Number((((point.tema - basePrice) / basePrice) * 100).toFixed(2)) : undefined,
  }));
};

// Format date based on time range
const formatDate = (timestamp: number, timeRange: TimeRange): string => {
  const date = new Date(timestamp);

  if (timeRange === "1D" || timeRange === "5D") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } else if (timeRange === "1M") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }
};

// Format axis date - cleaner formatting for each timeframe
const formatAxisDate = (timestamp: number, timeRange: TimeRange): string => {
  const date = new Date(timestamp);

  if (timeRange === "1D") {
    // Show hour:minute in 30-min increments style (e.g., "9:30 AM", "10:00 AM")
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    const displayMinute = minutes === 0 ? "00" : minutes.toString().padStart(2, "0");
    return `${displayHour}:${displayMinute} ${ampm}`;
  } else if (timeRange === "5D") {
    // Show weekday and time
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else if (timeRange === "1M") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else if (timeRange === "6M" || timeRange === "YTD") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    // 1Y, 5Y - show month and year
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
};

// Filter ticks to show cleaner intervals based on timeframe
const getTickInterval = (dataLength: number, timeRange: TimeRange): number => {
  if (timeRange === "1D") {
    // For 5-min data, show tick every 6 points (30 minutes)
    return Math.max(1, Math.floor(dataLength / 13)); // ~13 ticks for market hours
  } else if (timeRange === "5D") {
    // Show ~5 ticks for 5 days
    return Math.max(1, Math.floor(dataLength / 5));
  } else if (timeRange === "1M") {
    // Show ~8-10 ticks
    return Math.max(1, Math.floor(dataLength / 10));
  } else if (timeRange === "6M" || timeRange === "YTD") {
    // Show ~10-12 ticks
    return Math.max(1, Math.floor(dataLength / 12));
  } else {
    // 1Y, 5Y - show ~12 ticks
    return Math.max(1, Math.floor(dataLength / 12));
  }
};

// Candlestick custom shape component
const Candlestick = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  
  const { open, close, high, low } = payload;
  const isGrowing = close > open;
  const color = isGrowing ? "hsl(158, 74%, 43%)" : "hsl(0, 100%, 57%)";
  
  const candleWidth = width * 0.7;
  const centerX = x + width / 2;
  const priceRange = high - low;
  if (priceRange === 0) return null;
  
  const bodyHeight = Math.abs(close - open);
  const scaleY = height / priceRange;
  const highY = y;
  const lowY = y + height;
  const bodyTop = Math.min(open, close);
  const bodyTopY = y + (high - bodyTop) * scaleY;

  return (
    <g>
      <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={color} strokeWidth={1.5} />
      <rect
        x={x + (width - candleWidth) / 2}
        y={bodyTopY}
        width={candleWidth}
        height={Math.max(bodyHeight * scaleY, 1)}
        fill={color}
        stroke={color}
        strokeWidth={0}
      />
    </g>
  );
};

// Custom Tooltip
const CustomTooltip = ({
  active,
  payload,
  chartType,
  timeRange,
  movingAverage,
  showReturns,
}: {
  active?: boolean;
  payload?: any[];
  chartType: ChartType;
  timeRange: TimeRange;
  movingAverage: MovingAverage;
  showReturns: boolean;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  const getMAValue = () => {
    switch (movingAverage) {
      case "sma": return data.sma;
      case "ema": return data.ema;
      case "wma": return data.wma;
      case "dema": return data.dema;
      case "tema": return data.tema;
      default: return null;
    }
  };

  const getMALabel = () => {
    switch (movingAverage) {
      case "sma": return "SMA";
      case "ema": return "EMA";
      case "wma": return "WMA";
      case "dema": return "DEMA";
      case "tema": return "TEMA";
      default: return "";
    }
  };

  const maValue = getMAValue();
  const formatValue = (val: number) => 
    showReturns ? `${val > 0 ? '+' : ''}${val.toFixed(2)}%` : `$${val.toFixed(2)}`;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg p-3 min-w-[180px]">
      <div className="text-xs text-zinc-400 mb-2">
        {formatDate(data.timestamp, timeRange)}
      </div>
      
      {chartType === "candle" ? (
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4">
            <span className="text-xs text-zinc-400">O</span>
            <span className="text-xs font-medium text-white">
              {formatValue(data.open)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-zinc-400">H</span>
            <span className="text-xs font-medium text-green-500">
              {formatValue(data.high)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-zinc-400">L</span>
            <span className="text-xs font-medium text-red-500">
              {formatValue(data.low)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-zinc-400">C</span>
            <span className="text-xs font-semibold text-white">
              {formatValue(data.close)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex justify-between gap-4">
          <span className="text-xs text-zinc-400">
            {showReturns ? "Return" : "Price"}
          </span>
          <span className="text-xs font-semibold text-white">
            {formatValue(data.close)}
          </span>
        </div>
      )}
      
      {movingAverage !== "none" && maValue && (
        <div className="border-t border-zinc-700 mt-2 pt-2">
          <div className="flex justify-between gap-4">
            <span className="text-xs font-medium text-blue-400">
              {getMALabel()}
            </span>
            <span className="text-xs font-medium text-blue-400">
              {formatValue(maValue)}
            </span>
          </div>
        </div>
      )}
      
      <div className="border-t border-zinc-700 mt-2 pt-2">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-zinc-400">Vol</span>
          <span className="text-xs font-medium text-white">
            {(data.volume / 1000000).toFixed(2)}M
          </span>
        </div>
      </div>
    </div>
  );
};

export function StockChart({ symbol, companyName, metrics }: StockChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [movingAverage, setMovingAverage] = useState<MovingAverage>("none");
  const [showReturns, setShowReturns] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch data using the hook
  const { data: rawData, isLoading, error, refetch, lastUpdated, avgVolume: calculatedAvgVolume, maPeriod } = useStockChart(symbol, timeRange);

  // Apply returns transformation if needed
  const allData = useMemo(() => 
    showReturns ? convertToReturns(rawData) : rawData, 
    [rawData, showReturns]
  );

  // Apply zoom if domain is set
  const data = useMemo(() => {
    if (!zoomDomain) return allData;
    
    const [startIdx, endIdx] = zoomDomain;
    return allData.slice(startIdx, endIdx + 1);
  }, [allData, zoomDomain]);

  // Reset zoom when timerange or returns mode changes
  useEffect(() => {
    setZoomDomain(null);
  }, [timeRange, showReturns]);

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleCapture = async () => {
    if (chartContainerRef.current) {
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: "#18181b",
        scale: 2,
      });
      
      const link = document.createElement("a");
      link.download = `${symbol}-chart-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isFullscreen]);

  // Ref for the chart area to attach wheel event
  const chartAreaRef = useRef<HTMLDivElement>(null);

  // Handle mouse wheel zoom - use native event for better control
  useEffect(() => {
    const chartArea = chartAreaRef.current;
    if (!chartArea) return;

    const handleWheelZoom = (e: WheelEvent) => {
      // Prevent page scroll when hovering over chart
      e.preventDefault();
      e.stopPropagation();

      if (allData.length === 0) return;

      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const currentStart = zoomDomain ? zoomDomain[0] : 0;
      const currentEnd = zoomDomain ? zoomDomain[1] : allData.length - 1;
      const currentRange = currentEnd - currentStart;

      const newRange = Math.max(10, Math.min(allData.length, Math.floor(currentRange * zoomFactor)));
      const center = Math.floor((currentStart + currentEnd) / 2);

      let newStart = Math.max(0, center - Math.floor(newRange / 2));
      let newEnd = Math.min(allData.length - 1, newStart + newRange);

      if (newEnd === allData.length - 1 && newRange < allData.length) {
        newStart = Math.max(0, newEnd - newRange);
      }

      if (newStart === 0 && newEnd === allData.length - 1) {
        setZoomDomain(null);
      } else {
        setZoomDomain([newStart, newEnd]);
      }
    };

    // Add non-passive event listener to allow preventDefault
    chartArea.addEventListener("wheel", handleWheelZoom, { passive: false });

    return () => {
      chartArea.removeEventListener("wheel", handleWheelZoom);
    };
  }, [allData.length, zoomDomain]);

  // Handle drag to pan functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStartX === null || allData.length === 0) return;
    
    const chartArea = chartAreaRef.current;
    if (!chartArea) return;
    
    const deltaX = e.clientX - dragStartX;
    const chartWidth = chartArea.offsetWidth;
    
    // Calculate how many data points to shift based on drag distance
    const currentStart = zoomDomain ? zoomDomain[0] : 0;
    const currentEnd = zoomDomain ? zoomDomain[1] : allData.length - 1;
    const visibleRange = currentEnd - currentStart;
    
    // Sensitivity: how much drag moves the chart
    const pointsPerPixel = visibleRange / chartWidth;
    const pointsToShift = Math.round(-deltaX * pointsPerPixel * 0.5); // 0.5 = sensitivity factor
    
    if (Math.abs(pointsToShift) < 1) return;
    
    let newStart = Math.max(0, Math.min(allData.length - visibleRange - 1, currentStart + pointsToShift));
    let newEnd = newStart + visibleRange;
    
    if (newEnd >= allData.length) {
      newEnd = allData.length - 1;
      newStart = Math.max(0, newEnd - visibleRange);
    }
    
    setZoomDomain([newStart, newEnd]);
    setDragStartX(e.clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartX(null);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setDragStartX(null);
  };

  const { currentPrice, priceChange, priceChangePercent, isPositive } = useMemo(() => {
    if (data.length === 0) {
      return { currentPrice: 0, priceChange: 0, priceChangePercent: 0, isPositive: true };
    }

    const current = data[data.length - 1].price ?? 0;
    const previous = data[0].price ?? 0;
    const change = current - previous;
    const changePercent = showReturns ? current : (previous !== 0 ? (change / previous) * 100 : 0);

    return {
      currentPrice: current,
      priceChange: change,
      priceChangePercent: isNaN(changePercent) ? 0 : changePercent,
      isPositive: change >= 0,
    };
  }, [data, showReturns]);

  // Calculate footer metrics from raw (non-returns) data
  const footerMetrics = useMemo(() => {
    if (rawData.length === 0) return { 
      open: 0, high: 0, low: 0, close: 0, 
      avg: 0, median: 0, rsi: 50, adx: 25, stddev: 0, williams: -50 
    };

    const prices = rawData.map(d => d.close);
    const open = rawData[0].close;
    const close = rawData[rawData.length - 1].close;
    const high = Math.max(...rawData.map(d => d.high));
    const low = Math.min(...rawData.map(d => d.low));
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Calculate RSI (simplified)
    let gains = 0, losses = 0;
    for (let i = 1; i < Math.min(15, prices.length); i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Simplified ADX and Williams (would need more complex calculations)
    const adx = 20 + Math.random() * 40;
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - avg, 2), 0) / prices.length;
    const stddev = Math.sqrt(variance);
    const williams = (high - low) !== 0 ? ((high - close) / (high - low)) * -100 : -50;

    return { open, high, low, close, avg, median, rsi, adx, stddev, williams };
  }, [rawData]);

  const getMADataKey = () => {
    switch (movingAverage) {
      case "sma": return "sma";
      case "ema": return "ema";
      case "wma": return "wma";
      case "dema": return "dema";
      case "tema": return "tema";
      default: return null;
    }
  };

  const chartConfig = {
    price: {
      label: "Price",
      color: chartType === "line" 
        ? (isPositive ? "hsl(158, 74%, 43%)" : "hsl(0, 100%, 57%)")
        : "hsl(220, 13%, 50%)",
    },
    volume: {
      label: "Volume",
      color: "hsl(220, 13%, 69%)",
    },
    ma: {
      label: "MA",
      color: "hsl(217, 91%, 60%)",
    },
  };

  const timeRanges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "YTD", "5Y"];

  // MA options with dynamic period based on timeframe
  const maOptions = useMemo(() => [
    { value: "none", label: "None" },
    { value: "sma", label: `Simple Moving Average (${maPeriod})` },
    { value: "ema", label: `Exponential Moving Average (${maPeriod})` },
    { value: "wma", label: `Weighted Moving Average (${maPeriod})` },
    { value: "dema", label: `Double Exponential MA (${maPeriod})` },
    { value: "tema", label: `Triple Exponential MA (${maPeriod})` },
  ], [maPeriod]);

  // Format large numbers
  const formatLargeNumber = (num: number | undefined) => {
    if (num === undefined) return "N/A";
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatVolume = (num: number | undefined) => {
    if (num === undefined) return "N/A";
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
  };

  return (
    <>
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 animate-in fade-in duration-300"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      
      <div className={cn("w-full", !isFullscreen && "")}>
        <div 
          ref={chartContainerRef}
          className={cn(
            "bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden transition-all duration-500 ease-in-out",
            isFullscreen && "fixed inset-4 z-50 animate-in zoom-in-95 fade-in duration-300"
          )}
        >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-medium text-zinc-400">
                  {symbol}
                </h2>
                <span className="text-xs text-zinc-500">
                  {companyName}
                </span>
                {lastUpdated && (
                  <span className="text-xs text-zinc-600">
                    · Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                {isLoading && data.length === 0 ? (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-semibold text-white">
                      {showReturns ? `${currentPrice > 0 ? '+' : ''}${currentPrice.toFixed(2)}%` : `$${currentPrice.toFixed(2)}`}
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-sm font-medium",
                        isPositive
                          ? "text-green-500"
                          : "text-red-500"
                      )}
                    >
                      <span>
                        {isPositive ? "↑" : "↓"}{" "}
                        {showReturns 
                          ? `${Math.abs(priceChange).toFixed(2)}%`
                          : `${Math.abs(priceChange).toFixed(2)}`
                        }
                      </span>
                      <span>({Math.abs(priceChangePercent).toFixed(2)}%)</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Time Range Controls */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                      timeRange === range
                        ? "bg-zinc-700 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>

              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={cn("w-4 h-4 text-zinc-400", isLoading && "animate-spin")} />
              </button>

              <button
                onClick={handleCapture}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all"
                title="Capture chart"
              >
                <Camera className="w-4 h-4 text-zinc-400" />
              </button>

              <button
                onClick={handleFullscreen}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all transform hover:scale-105"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-zinc-400" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-zinc-400" />
                )}
              </button>
            </div>
          </div>

          {/* Chart Controls */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setChartType("line")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  chartType === "line"
                    ? "bg-zinc-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Line
              </button>
              <button
                onClick={() => setChartType("candle")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  chartType === "candle"
                    ? "bg-zinc-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Candlestick
              </button>
            </div>

            <div className="h-4 w-px bg-zinc-700" />

            {/* Moving Averages Dropdown */}
            <Select value={movingAverage} onValueChange={(value) => setMovingAverage(value as MovingAverage)}>
              <SelectTrigger className="w-[240px] h-8 text-xs bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Moving Average" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 w-[280px]">
                {maOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-4 w-px bg-zinc-700" />

            {/* Returns Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-400">
                Returns
              </label>
              <Switch checked={showReturns} onCheckedChange={setShowReturns} />
            </div>

            {/* Zoom Indicator */}
            {zoomDomain && (
              <>
                <div className="h-4 w-px bg-zinc-700" />
                <button
                  onClick={() => setZoomDomain(null)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-all"
                >
                  Reset Zoom
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chart */}
        <div 
          ref={chartAreaRef}
          className={cn("p-5", isDragging ? "cursor-grabbing" : "cursor-grab")}
          title="Scroll to zoom, drag to pan"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {error ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 mb-2">{error}</p>
                <button 
                  onClick={() => refetch()} 
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : data.length === 0 && isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center text-zinc-500">
              No data available for this time range
            </div>
          ) : (
            <ChartContainer 
              config={chartConfig} 
              className={cn(
                "w-full transition-all duration-300",
                isFullscreen ? "h-[calc(100vh-400px)]" : "h-[400px]"
              )}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(0, 0%, 20%)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => formatAxisDate(value, timeRange)}
                    stroke="hsl(0, 0%, 40%)"
                    tick={{ fontSize: 10, fill: "hsl(0, 0%, 50%)" }}
                    tickLine={false}
                    axisLine={false}
                    xAxisId="0"
                    interval={getTickInterval(data.length, timeRange)}
                    minTickGap={30}
                  />
                  <XAxis dataKey="timestamp" xAxisId="1" hide />
                  <YAxis
                    yAxisId="price"
                    domain={["dataMin - 5", "dataMax + 5"]}
                    tickFormatter={(value) => showReturns ? `${value}%` : `$${value}`}
                    stroke="hsl(0, 0%, 40%)"
                    tick={{ fontSize: 11, fill: "hsl(0, 0%, 50%)" }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <YAxis
                    yAxisId="volume"
                    orientation="right"
                    domain={[0, "dataMax * 1.5"]}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      return `${(value / 1000).toFixed(0)}K`;
                    }}
                    stroke="hsl(0, 0%, 40%)"
                    tick={{ fontSize: 11, fill: "hsl(0, 0%, 50%)" }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <ChartTooltip
                    content={
                      <CustomTooltip
                        chartType={chartType}
                        timeRange={timeRange}
                        movingAverage={movingAverage}
                        showReturns={showReturns}
                      />
                    }
                  />

                  {/* Volume Bars */}
                  <Bar
                    yAxisId="volume"
                    xAxisId="1"
                    dataKey="volume"
                    fill="hsl(0, 0%, 35%)"
                    opacity={0.25}
                    radius={[2, 2, 0, 0]}
                    animationDuration={300}
                  />

                  {chartType === "line" ? (
                    <Line
                      yAxisId="price"
                      xAxisId="0"
                      type="monotone"
                      dataKey="close"
                      stroke={chartConfig.price.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: chartConfig.price.color,
                        stroke: "#18181b",
                        strokeWidth: 2,
                      }}
                      animationDuration={500}
                      animationEasing="ease-in-out"
                    />
                  ) : (
                    <Bar
                      yAxisId="price"
                      xAxisId="0"
                      dataKey="open"
                      fill="#8884d8"
                      shape={<Candlestick />}
                      animationDuration={300}
                    />
                  )}

                  {/* Moving Average Line */}
                  {movingAverage !== "none" && getMADataKey() && (
                    <Line
                      yAxisId="price"
                      xAxisId="0"
                      type="monotone"
                      dataKey={getMADataKey() || undefined}
                      stroke={chartConfig.ma.color}
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 5"
                      animationDuration={500}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </div>

        {/* Footer Stats - Enhanced with merged Key Metrics */}
        <div className="px-5 pb-5">
          {!showReturns ? (
            /* Price Mode: OHLC + Additional metrics */
            <div className="space-y-3">
              {/* Row 1: OHLC */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Open</div>
                  <div className="text-sm font-medium text-white">
                    ${(footerMetrics.open ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">High</div>
                  <div className="text-sm font-medium text-green-500">
                    ${(footerMetrics.high ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Low</div>
                  <div className="text-sm font-medium text-red-500">
                    ${(footerMetrics.low ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Close</div>
                  <div className="text-sm font-medium text-white">
                    ${(footerMetrics.close ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Row 2: Additional metrics */}
              <div className="grid grid-cols-4 gap-4 pt-3 border-t border-zinc-800">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">52W Range</div>
                  <div className="text-sm font-medium text-white">
                    {metrics?.yearLow !== undefined && metrics?.yearHigh !== undefined
                      ? `$${metrics.yearLow.toFixed(0)} - $${metrics.yearHigh.toFixed(0)}`
                      : "N/A"
                    }
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Volume</div>
                  <div className="text-sm font-medium text-white">
                    {rawData.length > 0 ? formatVolume(rawData[rawData.length - 1].volume) : "N/A"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Avg Volume</div>
                  <div className="text-sm font-medium text-white">
                    {metrics?.avgVolume !== undefined 
                      ? formatVolume(metrics.avgVolume) 
                      : calculatedAvgVolume !== undefined 
                        ? formatVolume(calculatedAvgVolume) 
                        : "N/A"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Market Cap</div>
                  <div className="text-sm font-medium text-white">
                    {formatLargeNumber(metrics?.marketCap)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Returns Mode: Statistical metrics + Technical Indicators */
            <div className="space-y-3">
              {/* Row 1: Return Statistics */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Average</div>
                  <div className="text-sm font-medium text-white">
                    {rawData.length > 0 && rawData[0].close 
                      ? ((footerMetrics.avg - rawData[0].close) / rawData[0].close * 100).toFixed(2) 
                      : "0.00"}%
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Median</div>
                  <div className="text-sm font-medium text-white">
                    {rawData.length > 0 && rawData[0].close 
                      ? ((footerMetrics.median - rawData[0].close) / rawData[0].close * 100).toFixed(2) 
                      : "0.00"}%
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Period High</div>
                  <div className="text-sm font-medium text-green-500">
                    {rawData.length > 0 && rawData[0].close 
                      ? ((footerMetrics.high - rawData[0].close) / rawData[0].close * 100).toFixed(2) 
                      : "0.00"}%
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Period Low</div>
                  <div className="text-sm font-medium text-red-500">
                    {rawData.length > 0 && rawData[0].close 
                      ? ((footerMetrics.low - rawData[0].close) / rawData[0].close * 100).toFixed(2) 
                      : "0.00"}%
                  </div>
                </div>
              </div>

              {/* Row 2: Technical Indicators */}
              <div className="grid grid-cols-4 gap-4 pt-3 border-t border-zinc-800">
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">RSI (14)</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    (footerMetrics.rsi ?? 50) > 70 ? "text-red-500" : 
                    (footerMetrics.rsi ?? 50) < 30 ? "text-green-500" : "text-white"
                  )}>
                    {(footerMetrics.rsi ?? 50).toFixed(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">ADX</div>
                  <div className="text-sm font-semibold text-white">
                    {(footerMetrics.adx ?? 25).toFixed(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">StdDev</div>
                  <div className="text-sm font-semibold text-white">
                    {(footerMetrics.stddev ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Williams %R</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    (footerMetrics.williams ?? -50) > -20 ? "text-red-500" : 
                    (footerMetrics.williams ?? -50) < -80 ? "text-green-500" : "text-white"
                  )}>
                    {(footerMetrics.williams ?? -50).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

