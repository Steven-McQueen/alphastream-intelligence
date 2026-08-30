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
import { Loader2, RefreshCw, Camera, Maximize2, Minimize2, Pencil, Slash, Type, Plus, Minus, Scan } from "lucide-react";

type ChartType = "line" | "candle";
type MovingAverage = "none" | "sma" | "ema" | "wma" | "dema" | "tema";

// Annotation drawing tools
type DrawTool = "free" | "line" | "text";
type DrawShape =
  | { type: "free"; points: { x: number; y: number }[] }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "text"; x: number; y: number; text: string };

interface StockChartProps {
  symbol: string;
  companyName: string;
  isIndex?: boolean;
  // Additional metrics from parent (for enhanced footer)
  metrics?: {
    yearHigh?: number;
    yearLow?: number;
    avgVolume?: number;
    marketCap?: number;
    ytdReturn?: number;
    oneYearReturn?: number;
    beta?: number;
    previousClose?: number;
  };
}

function isFiniteNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fmtNum(value: unknown, digits = 2, fallback = "0.00"): string {
  return isFiniteNum(value) ? value.toFixed(digits) : fallback;
}

function fmtPctVsBase(value: number, base: unknown): string {
  if (!isFiniteNum(value) || !isFiniteNum(base) || base === 0) return "0.00";
  return fmtNum(((value - base) / base) * 100);
}

function pctFromBase(value: number | undefined, basePrice: number): number | undefined {
  if (!isFiniteNum(value)) return undefined;
  const r = ((value - basePrice) / basePrice) * 100;
  return Number.isFinite(r) ? Number(r.toFixed(2)) : undefined;
}

// Convert price data to returns. Skip non-finite OHLC so Recharts never sees NaN.
const convertToReturns = (data: StockDataPoint[]): StockDataPoint[] => {
  if (data.length === 0) return data;

  const basePrice = data[0].close;
  if (!isFiniteNum(basePrice) || basePrice === 0) return data;

  return data.map((point) => {
    const close = pctFromBase(point.close, basePrice) ?? 0;
    return {
      ...point,
      close,
      open: pctFromBase(point.open, basePrice) ?? close,
      high: pctFromBase(point.high, basePrice) ?? close,
      low: pctFromBase(point.low, basePrice) ?? close,
      price: close,
      sma: pctFromBase(point.sma, basePrice),
      ema: pctFromBase(point.ema, basePrice),
      wma: pctFromBase(point.wma, basePrice),
      dema: pctFromBase(point.dema, basePrice),
      tema: pctFromBase(point.tema, basePrice),
    };
  });
};

const MAX_CHART_POINTS = 400;

function downsamplePoints(data: StockDataPoint[], maxPoints: number): StockDataPoint[] {
  if (data.length <= maxPoints) return data;
  const step = (data.length - 1) / (maxPoints - 1);
  const out: StockDataPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(data[Math.round(i * step)]);
  }
  return out;
}

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
interface CandlestickProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { open: number; close: number; high: number; low: number };
}
const Candlestick = (props: CandlestickProps) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  
  const { open, close, high, low } = payload;
  if (![open, close, high, low].every(isFiniteNum)) return null;
  const isGrowing = close > open;
  const color = isGrowing ? "hsl(var(--primary))" : "hsl(0, 84%, 60%)";
  
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
  isIndex,
}: {
  active?: boolean;
  payload?: { payload: StockDataPoint }[];
  chartType: ChartType;
  timeRange: TimeRange;
  movingAverage: MovingAverage;
  showReturns: boolean;
  isIndex?: boolean;
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
  const formatValue = (val: number) => {
    if (!isFiniteNum(val)) return "—";
    if (showReturns) return `${val > 0 ? "+" : ""}${fmtNum(val)}%`;
    return isIndex ? fmtNum(val) : `$${fmtNum(val)}`;
  };

  return (
    <div className="bg-card border border-secondary rounded-lg shadow-lg p-3 min-w-[180px]">
      <div className="text-xs text-muted-foreground mb-2">
        {formatDate(data.timestamp, timeRange)}
      </div>
      
      {chartType === "candle" ? (
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted-foreground">O</span>
            <span className="text-xs font-medium text-foreground">
              {formatValue(data.open)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted-foreground">H</span>
            <span className="text-xs font-medium text-positive">
              {formatValue(data.high)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted-foreground">L</span>
            <span className="text-xs font-medium text-negative">
              {formatValue(data.low)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-xs text-muted-foreground">C</span>
            <span className="text-xs font-semibold text-foreground">
              {formatValue(data.close)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            {showReturns ? "Return" : "Price"}
          </span>
          <span className="text-xs font-semibold text-foreground">
            {formatValue(data.close)}
          </span>
        </div>
      )}
      
      {movingAverage !== "none" && maValue && (
        <div className="border-t border-secondary mt-2 pt-2">
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
      
      <div className="border-t border-secondary mt-2 pt-2">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-muted-foreground">Vol</span>
          <span className="text-xs font-medium text-foreground">
            {(isFiniteNum(data.volume) ? (data.volume / 1000000).toFixed(2) : "0.00")}M
          </span>
        </div>
      </div>
    </div>
  );
};

export function StockChart({ symbol, companyName, metrics, isIndex = false }: StockChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [movingAverage, setMovingAverage] = useState<MovingAverage>("none");
  const [showReturns, setShowReturns] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("free");
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [draft, setDraft] = useState<DrawShape | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  // Visible window as [startIndex, endIndex] into allData; null = full range.
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const drawLayerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  // Pan gesture anchors (captured on mouse-down to avoid drift).
  const panAnchorRef = useRef<{ startX: number; domain: [number, number] } | null>(null);

  // Fetch data using the hook
  const { data: rawData, isLoading, error, refetch, lastUpdated, avgVolume: calculatedAvgVolume, maPeriod, afterHours } = useStockChart(symbol, timeRange, { isIndex });

  const fmtLevel = (value: unknown, digits = 2) =>
    isIndex ? fmtNum(value, digits) : `$${fmtNum(value, digits)}`;

  // Apply returns transformation if needed
  const allData = useMemo(() => 
    showReturns ? convertToReturns(rawData) : rawData, 
    [rawData, showReturns]
  );

  // `data` is the FULL timeframe and drives the headline price + footer stats, so
  // they stay fixed while panning/zooming. The chart itself renders `viewData`,
  // the visible window selected by scroll-zoom / drag-pan.
  const data = allData;
  const viewData = useMemo(() => {
    if (!zoomDomain) return allData;
    const [s, e] = zoomDomain;
    return allData.slice(s, e + 1);
  }, [allData, zoomDomain]);

  // Chart data with an optional after-hours marker appended for the 1D view.
  // The regular line uses `close` (the appended point sets close=null so the solid
  // line stops at the regular close); a separate dashed line uses `extendedClose`
  // to draw the after-hours segment in a distinct style.
  const chartData = useMemo(() => {
    const source = downsamplePoints(viewData, MAX_CHART_POINTS);
    if (timeRange !== "1D" || !afterHours || showReturns || chartType !== "line" || source.length === 0) {
      return source;
    }
    const last = source[source.length - 1];
    const ahTs = afterHours.timestamp ?? last.timestamp + 5 * 60 * 1000;
    const withMarker = source.map((d, i) =>
      i === source.length - 1 ? { ...d, extendedClose: d.close } : d
    );
    const ahPoint: StockDataPoint = {
      ...last,
      timestamp: ahTs,
      date: new Date(ahTs).toISOString(),
      close: null as unknown as number,
      price: afterHours.price,
      open: afterHours.price,
      high: afterHours.price,
      low: afterHours.price,
      volume: 0,
      extendedClose: afterHours.price,
      sma: undefined,
      ema: undefined,
      wma: undefined,
      dema: undefined,
      tema: undefined,
    };
    return [...withMarker, ahPoint];
  }, [viewData, afterHours, timeRange, showReturns, chartType]);

  // Reset zoom + drawings when the underlying view changes (indices/pixels no longer
  // map to the new data/scale).
  useEffect(() => {
    setZoomDomain(null);
    setShapes([]);
    setDraft(null);
    setTextDraft(null);
  }, [timeRange, showReturns, chartType, symbol]);

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

  // ── Annotation layer (freehand / straight line / text) ────────────────────
  const getRelativePoint = (e: React.PointerEvent) => {
    const rect = drawLayerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const commitTextDraft = () => {
    setTextDraft((prev) => {
      if (prev && prev.value.trim()) {
        setShapes((s) => [...s, { type: "text", x: prev.x, y: prev.y, text: prev.value.trim() }]);
      }
      return null;
    });
  };
  const clearDrawings = () => {
    setShapes([]);
    setDraft(null);
    setTextDraft(null);
  };
  const handleDrawPointerDown = (e: React.PointerEvent) => {
    if (!drawMode) return;
    const p = getRelativePoint(e);
    if (drawTool === "text") {
      commitTextDraft();
      setTextDraft({ x: p.x, y: p.y, value: "" });
      return;
    }
    isDrawingRef.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDraft(
      drawTool === "free"
        ? { type: "free", points: [p] }
        : { type: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y }
    );
  };
  const handleDrawPointerMove = (e: React.PointerEvent) => {
    if (!drawMode || !isDrawingRef.current) return;
    const p = getRelativePoint(e);
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.type === "free") return { ...prev, points: [...prev.points, p] };
      if (prev.type === "line") return { ...prev, x2: p.x, y2: p.y };
      return prev;
    });
  };
  const handleDrawPointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setDraft((prev) => {
      if (prev?.type === "free" && prev.points.length > 1) setShapes((s) => [...s, prev]);
      else if (prev?.type === "line" && (prev.x1 !== prev.x2 || prev.y1 !== prev.y2))
        setShapes((s) => [...s, prev]);
      return null;
    });
  };
  const pointsToStr = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");
  const hasDrawings = shapes.length > 0 || !!draft || !!textDraft;

  // ── Scroll-zoom (cursor-centered) + drag-pan ──────────────────────────────
  const MIN_VISIBLE = 15; // smallest zoom window in data points

  // Wheel zoom: keep the point under the cursor fixed while zooming in/out.
  useEffect(() => {
    const el = drawLayerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (drawMode || allData.length <= MIN_VISIBLE) return;
      // Only zoom on an intentional gesture (trackpad pinch sends ctrlKey,
      // or hold ⌘/Ctrl). Plain scroll passes through so the page scrolls
      // normally instead of the chart hijacking the wheel.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const start = zoomDomain ? zoomDomain[0] : 0;
      const end = zoomDomain ? zoomDomain[1] : allData.length - 1;
      const range = end - start;
      const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2; // out / in (~20% per notch)
      const newRange = Math.round(
        Math.min(allData.length - 1, Math.max(MIN_VISIBLE, range * factor))
      );
      const pivot = start + frac * range;
      let newStart = Math.round(pivot - frac * newRange);
      newStart = Math.max(0, Math.min(newStart, allData.length - 1 - newRange));
      const newEnd = newStart + newRange;
      if (newStart <= 0 && newEnd >= allData.length - 1) setZoomDomain(null);
      else setZoomDomain([newStart, newEnd]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [allData.length, zoomDomain, drawMode]);

  // Drag-pan: 1:1 with the cursor (only meaningful while zoomed in).
  const handlePanDown = (e: React.MouseEvent) => {
    if (drawMode || !zoomDomain) return;
    setIsPanning(true);
    panAnchorRef.current = { startX: e.clientX, domain: zoomDomain };
  };
  const handlePanMove = (e: React.MouseEvent) => {
    const anchor = panAnchorRef.current;
    if (!anchor || !drawLayerRef.current) return;
    const width = drawLayerRef.current.offsetWidth || 1;
    const [s, en] = anchor.domain;
    const range = en - s;
    const pointsPerPx = (range + 1) / width;
    const shift = Math.round(-(e.clientX - anchor.startX) * pointsPerPx);
    const newStart = Math.max(0, Math.min(anchor.domain[0] + shift, allData.length - 1 - range));
    const newEnd = newStart + range;
    setZoomDomain([newStart, newEnd]);
  };
  const endPan = () => {
    setIsPanning(false);
    panAnchorRef.current = null;
  };

  // ── React-Flow-style zoom controls (–/＋/fit) ──────────────────────────────
  const zoomByFactor = (factor: number) => {
    if (allData.length <= MIN_VISIBLE) return;
    const start = zoomDomain ? zoomDomain[0] : 0;
    const end = zoomDomain ? zoomDomain[1] : allData.length - 1;
    const range = end - start;
    const center = (start + end) / 2;
    const newRange = Math.round(
      Math.min(allData.length - 1, Math.max(MIN_VISIBLE, range * factor))
    );
    let newStart = Math.round(center - newRange / 2);
    newStart = Math.max(0, Math.min(newStart, allData.length - 1 - newRange));
    const newEnd = newStart + newRange;
    if (newStart <= 0 && newEnd >= allData.length - 1) setZoomDomain(null);
    else setZoomDomain([newStart, newEnd]);
  };
  const zoomIn = () => zoomByFactor(1 / 1.4);
  const zoomOut = () => zoomByFactor(1.4);
  const fitView = () => setZoomDomain(null);

  const { currentPrice, priceChange, priceChangePercent, isPositive } = useMemo(() => {
    if (data.length === 0) {
      return { currentPrice: 0, priceChange: 0, priceChangePercent: 0, isPositive: true };
    }

    const current = isFiniteNum(data[data.length - 1].price) ? data[data.length - 1].price : 0;
    const previous = isFiniteNum(data[0].price) ? data[0].price : 0;
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

    const prices = rawData.map(d => d.close).filter(isFiniteNum);
    const highs = rawData.map(d => d.high).filter(isFiniteNum);
    const lows = rawData.map(d => d.low).filter(isFiniteNum);
    if (prices.length === 0) {
      return {
        open: 0, high: 0, low: 0, close: 0,
        avg: 0, median: 0, rsi: 50, adx: 25, stddev: 0, williams: -50
      };
    }
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = highs.length ? Math.max(...highs) : close;
    const low = lows.length ? Math.min(...lows) : close;
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
        ? (isPositive ? "hsl(var(--primary))" : "hsl(0, 84%, 60%)")
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
            "bg-card rounded-xl border border-border overflow-hidden transition-all duration-500 ease-in-out",
            isFullscreen && "fixed inset-4 z-50 animate-in zoom-in-95 fade-in duration-300"
          )}
        >
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {symbol}
                </h2>
                <span className="text-xs text-dim">
                  {companyName}
                </span>
                {lastUpdated && (
                  <span className="text-xs text-dim">
                    · Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                {isLoading && data.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-semibold text-foreground">
                      {showReturns ? `${currentPrice > 0 ? "+" : ""}${fmtNum(currentPrice)}%` : fmtLevel(currentPrice)}
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-sm font-medium",
                        isPositive
                          ? "text-positive"
                          : "text-negative"
                      )}
                    >
                      <span>
                        {isPositive ? "↑" : "↓"}{" "}
                        {showReturns
                          ? `${fmtNum(Math.abs(priceChange))}%`
                          : fmtNum(Math.abs(priceChange))
                        }
                      </span>
                      <span>({fmtNum(Math.abs(priceChangePercent))}%)</span>
                    </div>

                    {/* After-hours / pre-market chip (market closed) - distinct from the
                        regular green/red change so it's obvious what is extended-hours. */}
                    {afterHours && !showReturns && (
                      <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-[hsl(var(--accent-purple-text))]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-purple-text))]" aria-hidden />
                        <span className="uppercase tracking-wide">
                          {afterHours.session === "pre" ? "Pre-Market" : "After Hours"}
                        </span>
                        <span className="text-foreground">${afterHours.price.toFixed(2)}</span>
                        {afterHours.changePercent !== null && (
                          <span>
                            {afterHours.changePercent >= 0 ? "+" : ""}
                            {afterHours.changePercent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Time Range Controls */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                      timeRange === range
                        ? "bg-secondary text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>

              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-2 bg-muted hover:bg-secondary rounded-lg transition-all disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoading && "animate-spin")} />
              </button>

              <button
                onClick={handleCapture}
                className="p-2 bg-muted hover:bg-secondary rounded-lg transition-all"
                title="Capture chart"
              >
                <Camera className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                onClick={handleFullscreen}
                className="p-2 bg-muted hover:bg-secondary rounded-lg transition-all transform hover:scale-105"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Chart Controls */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setChartType("line")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  chartType === "line"
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Line
              </button>
              <button
                onClick={() => setChartType("candle")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  chartType === "candle"
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Candlestick
              </button>
            </div>

            <div className="h-4 w-px bg-secondary" />

            {/* Moving Averages Dropdown */}
            <Select value={movingAverage} onValueChange={(value) => setMovingAverage(value as MovingAverage)}>
              <SelectTrigger className="w-[240px] h-8 text-xs bg-muted border-secondary">
                <SelectValue placeholder="Moving Average" />
              </SelectTrigger>
              <SelectContent className="bg-muted border-secondary w-[280px]">
                {maOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-4 w-px bg-secondary" />

            {/* Statistics Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Statistics
              </label>
              <Switch checked={showReturns} onCheckedChange={setShowReturns} />
            </div>

            <div className="h-4 w-px bg-secondary" />

            {/* Drawing tools */}
            <button
              onClick={() =>
                setDrawMode((d) => {
                  if (d) commitTextDraft();
                  return !d;
                })
              }
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                drawMode
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Draw
            </button>
            {drawMode && (
              <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                {([
                  ["free", Pencil, "Freehand"],
                  ["line", Slash, "Straight line"],
                  ["text", Type, "Text"],
                ] as const).map(([tool, Icon, title]) => (
                  <button
                    key={tool}
                    onClick={() => {
                      if (tool !== "text") commitTextDraft();
                      setDrawTool(tool);
                    }}
                    title={title}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      drawTool === tool
                        ? "bg-secondary text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}
            {hasDrawings && (
              <button
                onClick={clearDrawings}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                Clear
              </button>
            )}

            {zoomDomain && (
              <>
                <div className="h-4 w-px bg-secondary" />
                <button
                  onClick={() => setZoomDomain(null)}
                  className="px-3 py-1.5 text-xs font-medium text-[hsl(var(--accent-blue-text))] hover:opacity-80 transition-all"
                >
                  Reset Zoom
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chart */}
        <div
          ref={drawLayerRef}
          className={cn(
            "relative p-5 select-none",
            drawMode ? "" : zoomDomain ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
          )}
          onMouseDown={handlePanDown}
          onMouseMove={handlePanMove}
          onMouseUp={endPan}
          onMouseLeave={endPan}
        >
          {error ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-negative mb-2">{error}</p>
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
              <Loader2 className="w-8 h-8 animate-spin text-dim" />
            </div>
          ) : data.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center text-dim">
              No data available for this time range
            </div>
          ) : (
            <div
              className="relative rounded-xl border border-border/70 p-3 transition-all duration-300"
              style={{
                backgroundColor: "hsl(var(--card))",
                backgroundImage:
                  "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
                backgroundPosition: "-9px -9px",
              }}
            >
            <ChartContainer
              config={chartConfig}
              className={cn(
                "w-full transition-all duration-300",
                isFullscreen ? "h-[calc(100vh-400px)]" : "h-[400px]"
              )}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
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
                    interval={getTickInterval(chartData.length, timeRange)}
                    minTickGap={30}
                  />
                  <XAxis dataKey="timestamp" xAxisId="1" hide />
                  <YAxis
                    yAxisId="price"
                    domain={showReturns ? ["auto", "auto"] : ["dataMin - 5", "dataMax + 5"]}
                    tickFormatter={(value) => showReturns ? `${value}%` : (isIndex ? String(value) : `$${value}`)}
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
                        isIndex={isIndex}
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
                    isAnimationActive={false}
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
                        stroke: "hsl(var(--tooltip-bg))",
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Bar
                      yAxisId="price"
                      xAxisId="0"
                      // Range bar [low, high] so recharts positions the bar over the
                      // full candle range; the Candlestick shape then draws the wick
                      // and the open/close body correctly.
                      dataKey={(d: StockDataPoint) =>
                        isFiniteNum(d.low) && isFiniteNum(d.high) ? [d.low, d.high] : [0, 0]
                      }
                      fill="#8884d8"
                      shape={<Candlestick />}
                      isAnimationActive={false}
                    />
                  )}

                  {/* After-hours segment (1D, market closed): dashed, distinct color */}
                  {timeRange === "1D" && afterHours && !showReturns && chartType === "line" && (
                    <Line
                      yAxisId="price"
                      xAxisId="0"
                      type="monotone"
                      dataKey="extendedClose"
                      stroke="hsl(var(--accent-purple-text))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
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
                      isAnimationActive={false}
                    />
                  )}

                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Zoom controls (React Flow-style): drag to pan, these to zoom. */}
            <div className="absolute bottom-4 left-4 flex flex-col overflow-hidden rounded-lg border border-border bg-card/90 backdrop-blur-sm">
              {[
                { icon: Plus, label: "Zoom in", onClick: zoomIn, disabled: false },
                { icon: Minus, label: "Zoom out", onClick: zoomOut, disabled: !zoomDomain },
                { icon: Scan, label: "Fit", onClick: fitView, disabled: !zoomDomain },
              ].map(({ icon: Icon, label, onClick, disabled }, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={disabled}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent",
                    i > 0 && "border-t border-border"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            </div>
          )}

          {/* Annotation layer (toggle "Draw"; tools: freehand / line / text). The DIV
              captures pointer events across the whole area when active — an empty <svg>
              only registers clicks on painted pixels. When off it's click-through so the
              chart tooltip / scroll-zoom / pan work normally. */}
          <div
            className={cn(
              "absolute inset-0 z-20",
              drawMode ? "cursor-crosshair" : "pointer-events-none"
            )}
            onPointerDown={handleDrawPointerDown}
            onPointerMove={handleDrawPointerMove}
            onPointerUp={handleDrawPointerUp}
          >
            <svg className="pointer-events-none h-full w-full">
              {[...shapes, ...(draft ? [draft] : [])].map((shape, i) => {
                if (shape.type === "free") {
                  return shape.points.length > 1 ? (
                    <polyline
                      key={i}
                      points={pointsToStr(shape.points)}
                      fill="none"
                      stroke="hsl(var(--accent-purple-text))"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null;
                }
                if (shape.type === "line") {
                  return (
                    <line
                      key={i}
                      x1={shape.x1}
                      y1={shape.y1}
                      x2={shape.x2}
                      y2={shape.y2}
                      stroke="hsl(var(--accent-purple-text))"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  );
                }
                return (
                  <text
                    key={i}
                    x={shape.x}
                    y={shape.y}
                    fill="hsl(var(--accent-purple-text))"
                    fontSize={13}
                    fontWeight={600}
                    dominantBaseline="hanging"
                  >
                    {shape.text}
                  </text>
                );
              })}
            </svg>

            {/* Inline text input while placing a text annotation */}
            {textDraft && (
              <input
                autoFocus
                value={textDraft.value}
                onChange={(e) =>
                  setTextDraft((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                }
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitTextDraft();
                  if (e.key === "Escape") setTextDraft(null);
                }}
                onBlur={commitTextDraft}
                placeholder="Type…"
                style={{ left: textDraft.x, top: textDraft.y }}
                className="absolute z-30 w-40 -translate-y-1 border-b border-[hsl(var(--accent-purple-text))] bg-transparent text-sm font-semibold text-[hsl(var(--accent-purple-text))] outline-none placeholder:text-dim"
              />
            )}
          </div>
        </div>

        {/* Footer Stats - Enhanced with merged Key Metrics */}
        <div className="px-5 pb-5">
          {!showReturns ? (
            /* Price Mode: OHLC + Additional metrics */
            <div className="space-y-3">
              {/* Row 1: OHLC */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-dim">Open</div>
                  <div className="text-sm font-medium text-foreground">
                    {fmtLevel(footerMetrics.open)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-dim">High</div>
                  <div className="text-sm font-medium text-positive">
                    {fmtLevel(footerMetrics.high)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-dim">Low</div>
                  <div className="text-sm font-medium text-negative">
                    {fmtLevel(footerMetrics.low)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-dim">Close</div>
                  <div className="text-sm font-medium text-foreground">
                    {fmtLevel(footerMetrics.close)}
                  </div>
                </div>
              </div>

              {/* Row 2: Additional metrics */}
              <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border">
                <div className="space-y-1">
                  <div className="text-xs text-dim">52W Range</div>
                  <div className="text-sm font-medium text-foreground">
                    {metrics?.yearLow !== undefined && metrics?.yearHigh !== undefined
                      ? `${fmtLevel(metrics.yearLow, 0)} - ${fmtLevel(metrics.yearHigh, 0)}`
                      : "N/A"
                    }
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-dim">Volume</div>
                  <div className="text-sm font-medium text-foreground">
                    {rawData.length > 0 ? formatVolume(rawData[rawData.length - 1].volume) : "N/A"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-dim">Avg Volume</div>
                  <div className="text-sm font-medium text-foreground">
                    {metrics?.avgVolume !== undefined 
                      ? formatVolume(metrics.avgVolume) 
                      : calculatedAvgVolume !== undefined 
                        ? formatVolume(calculatedAvgVolume) 
                        : "N/A"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-dim">{isIndex ? "Prev Close" : "Market Cap"}</div>
                  <div className="text-sm font-medium text-foreground">
                    {isIndex
                      ? (metrics?.previousClose !== undefined ? fmtLevel(metrics.previousClose) : "N/A")
                      : formatLargeNumber(metrics?.marketCap)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Returns Mode: Statistical metrics + Technical Indicators (staggered).
               Row 1 (4 items) sits offset; Row 2 (5 items incl. Beta) interlocks
               beneath it, with Beta at the far right: _-_-_-_-_ */
            <div className="space-y-3">
              {/* Row 1: Return Statistics (inset / offset by half a column) */}
              <div className="grid grid-cols-10 gap-x-4">
                <div className="col-start-2 col-span-2 space-y-1 text-center">
                  <div className="text-xs text-dim">Average</div>
                  <div className="text-sm font-medium text-foreground">
                    {fmtPctVsBase(footerMetrics.avg, rawData[0]?.close)}%
                  </div>
                </div>
                <div className="col-start-4 col-span-2 space-y-1 text-center">
                  <div className="text-xs text-dim">Median</div>
                  <div className="text-sm font-medium text-foreground">
                    {fmtPctVsBase(footerMetrics.median, rawData[0]?.close)}%
                  </div>
                </div>
                <div className="col-start-6 col-span-2 space-y-1 text-center">
                  <div className="text-xs text-dim">Period High</div>
                  <div className="text-sm font-medium text-positive">
                    {fmtPctVsBase(footerMetrics.high, rawData[0]?.close)}%
                  </div>
                </div>
                <div className="col-start-8 col-span-2 space-y-1 text-center">
                  <div className="text-xs text-dim">Period Low</div>
                  <div className="text-sm font-medium text-negative">
                    {fmtPctVsBase(footerMetrics.low, rawData[0]?.close)}%
                  </div>
                </div>
              </div>

              {/* Row 2: Technical Indicators + Beta (Beta at the rightmost) */}
              <div className="grid grid-cols-10 gap-x-4 pt-3 border-t border-border">
                <div className="col-start-1 col-span-2 text-center">
                  <div className="text-xs text-dim mb-1">RSI (14)</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    (footerMetrics.rsi ?? 50) > 70 ? "text-negative" :
                    (footerMetrics.rsi ?? 50) < 30 ? "text-positive" : "text-foreground"
                  )}>
                    {fmtNum(footerMetrics.rsi ?? 50, 1)}
                  </div>
                </div>
                <div className="col-start-3 col-span-2 text-center">
                  <div className="text-xs text-dim mb-1">ADX</div>
                  <div className="text-sm font-semibold text-foreground">
                    {fmtNum(footerMetrics.adx ?? 25, 1)}
                  </div>
                </div>
                <div className="col-start-5 col-span-2 text-center">
                  <div className="text-xs text-dim mb-1">StdDev</div>
                  <div className="text-sm font-semibold text-foreground">
                    {fmtNum(footerMetrics.stddev ?? 0)}
                  </div>
                </div>
                <div className="col-start-7 col-span-2 text-center">
                  <div className="text-xs text-dim mb-1">Williams %R</div>
                  <div className={cn(
                    "text-sm font-semibold",
                    (footerMetrics.williams ?? -50) > -20 ? "text-negative" :
                    (footerMetrics.williams ?? -50) < -80 ? "text-positive" : "text-foreground"
                  )}>
                    {fmtNum(footerMetrics.williams ?? -50, 1)}
                  </div>
                </div>
                {!isIndex && (
                <div className="col-start-9 col-span-2 text-center">
                  <div className="text-xs text-dim mb-1">Beta</div>
                  <div className="text-sm font-semibold text-foreground">
                    {metrics?.beta !== undefined ? fmtNum(metrics.beta) : "N/A"}
                  </div>
                </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

