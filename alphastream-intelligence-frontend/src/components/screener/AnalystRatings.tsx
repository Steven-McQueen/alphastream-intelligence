import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line
} from "recharts";

const API_BASE_URL = "http://localhost:8000";

interface AnalystRatingsProps {
  ticker: string;
  currentPrice?: number;
}

interface GradesConsensus {
  buy?: number;
  strongBuy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;
  consensus?: string;
}

interface PriceTarget {
  targetHigh?: number;
  targetLow?: number;
  targetConsensus?: number;
  targetMedian?: number;
  numberOfAnalysts?: number;
}

interface RatingHistorical {
  date: string;
  rating: string;
  overallScore: number;  // FMP API returns overallScore not ratingScore
  ratingRecommendation?: string;
  discountedCashFlowScore?: number;
  returnOnEquityScore?: number;
  returnOnAssetsScore?: number;
  debtToEquityScore?: number;
  priceToEarningsScore?: number;
  priceToBookScore?: number;
}

interface AnalystGrade {
  date: string;
  gradingCompany: string;
  previousGrade?: string;
  newGrade: string;
  action: string;
}

interface RatingsData {
  symbol: string;
  consensusRating: string;
  consensusScore: number;
  ratingsHistorical: RatingHistorical[];
  gradesConsensus: GradesConsensus;
  priceTarget: PriceTarget;
  priceTargetSummary: Record<string, unknown>;
  recentGrades: AnalystGrade[];
}

// Rating color mapping
const getRatingColor = (rating: string): string => {
  const r = rating?.toLowerCase() || "";
  if (r.includes("strong buy")) return "text-emerald-400";
  if (r.includes("buy") || r.includes("outperform") || r.includes("overweight")) return "text-green-400";
  if (r.includes("hold") || r.includes("neutral") || r.includes("equal")) return "text-yellow-400";
  if (r.includes("sell") || r.includes("underperform") || r.includes("underweight")) return "text-orange-400";
  if (r.includes("strong sell")) return "text-red-400";
  return "text-zinc-400";
};

const getRatingBgColor = (rating: string): string => {
  const r = rating?.toLowerCase() || "";
  if (r.includes("strong buy")) return "bg-emerald-500/20 border-emerald-500/30";
  if (r.includes("buy") || r.includes("outperform") || r.includes("overweight")) return "bg-green-500/20 border-green-500/30";
  if (r.includes("hold") || r.includes("neutral") || r.includes("equal")) return "bg-yellow-500/20 border-yellow-500/30";
  if (r.includes("sell") || r.includes("underperform") || r.includes("underweight")) return "bg-orange-500/20 border-orange-500/30";
  if (r.includes("strong sell")) return "bg-red-500/20 border-red-500/30";
  return "bg-zinc-500/20 border-zinc-500/30";
};

// Format relative date
const formatRelativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Action icon component
const ActionIcon = ({ action }: { action: string }) => {
  const a = action?.toLowerCase() || "";
  if (a.includes("upgrade") || a.includes("up")) {
    return <ArrowUpRight className="w-4 h-4 text-emerald-400" />;
  }
  if (a.includes("downgrade") || a.includes("down")) {
    return <ArrowDownRight className="w-4 h-4 text-red-400" />;
  }
  return <Minus className="w-4 h-4 text-zinc-400" />;
};

export function AnalystRatings({ ticker, currentPrice }: AnalystRatingsProps) {
  const [data, setData] = useState<RatingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllGrades, setShowAllGrades] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/analyst/ratings`);
        if (!res.ok) throw new Error("Failed to fetch analyst ratings");
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching analyst ratings:", err);
        setError("Failed to load analyst ratings");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker]);

  // Prepare chart data for distribution
  const distributionData = useMemo(() => {
    if (!data?.gradesConsensus) return [];
    const gc = data.gradesConsensus;
    return [
      { name: "Strong Buy", value: gc.strongBuy || 0, fill: "#10b981" },
      { name: "Buy", value: gc.buy || 0, fill: "#22c55e" },
      { name: "Hold", value: gc.hold || 0, fill: "#eab308" },
      { name: "Sell", value: gc.sell || 0, fill: "#f97316" },
      { name: "Strong Sell", value: gc.strongSell || 0, fill: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [data]);

  // Price target vs current price
  const priceTargetData = useMemo(() => {
    if (!data?.priceTarget || !currentPrice) return null;
    const pt = data.priceTarget;
    const target = pt.targetConsensus || pt.targetMedian;
    if (!target) return null;
    
    const upside = ((target - currentPrice) / currentPrice) * 100;
    return {
      current: currentPrice,
      target,
      high: pt.targetHigh,
      low: pt.targetLow,
      upside,
      analysts: pt.numberOfAnalysts,
    };
  }, [data, currentPrice]);

  // Display grades (limit or show all)
  const displayedGrades = useMemo(() => {
    if (!data?.recentGrades) return [];
    return showAllGrades ? data.recentGrades : data.recentGrades.slice(0, 5);
  }, [data, showAllGrades]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <span className="ml-2 text-zinc-400 text-sm">Loading analyst ratings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500">
        <p>No analyst data available for {ticker}</p>
      </div>
    );
  }

  const totalAnalysts = distributionData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Header: Consensus Rating */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Analyst Consensus
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Based on {totalAnalysts} analyst{totalAnalysts !== 1 ? "s" : ""} covering {ticker}
            </p>
          </div>
          <div className={cn(
            "px-4 py-2 rounded-lg border font-semibold text-lg",
            getRatingBgColor(data.consensusRating),
            getRatingColor(data.consensusRating)
          )}>
            {data.consensusRating}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Rating Distribution */}
          <div>
            <h4 className="text-sm font-medium text-zinc-400 mb-4">Rating Distribution</h4>
            <div className="space-y-3">
              {[
                { name: "Strong Buy", key: "strongBuy", color: "bg-emerald-500" },
                { name: "Buy", key: "buy", color: "bg-green-500" },
                { name: "Hold", key: "hold", color: "bg-yellow-500" },
                { name: "Sell", key: "sell", color: "bg-orange-500" },
                { name: "Strong Sell", key: "strongSell", color: "bg-red-500" },
              ].map(({ name, key, color }) => {
                const value = (data.gradesConsensus as Record<string, number>)[key] || 0;
                const percentage = totalAnalysts > 0 ? (value / totalAnalysts) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-zinc-400">{name}</div>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", color)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs text-zinc-300 text-right font-mono">
                      {value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rating Score Gauge */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {/* Background arc */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="8"
                />
                {/* Score arc */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={data.consensusScore >= 3.5 ? "#10b981" : data.consensusScore >= 2.5 ? "#eab308" : "#ef4444"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(data.consensusScore / 5) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{data.consensusScore.toFixed(1)}</span>
                <span className="text-xs text-zinc-500">out of 5</span>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mt-4 text-center">
              Consensus Score
            </p>
          </div>
        </div>
      </div>

      {/* Price Target */}
      {priceTargetData && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-emerald-400" />
            Price Target
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-zinc-500 mb-1">Current Price</div>
              <div className="text-lg font-bold text-white font-mono">
                ${priceTargetData.current.toFixed(2)}
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-zinc-500 mb-1">Target Price</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                ${priceTargetData.target.toFixed(2)}
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-zinc-500 mb-1">Upside/Downside</div>
              <div className={cn(
                "text-lg font-bold font-mono flex items-center justify-center gap-1",
                priceTargetData.upside >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {priceTargetData.upside >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {priceTargetData.upside >= 0 ? "+" : ""}{priceTargetData.upside.toFixed(1)}%
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-zinc-500 mb-1">Analysts</div>
              <div className="text-lg font-bold text-white font-mono flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                {priceTargetData.analysts || "-"}
              </div>
            </div>
          </div>

          {/* Price Range Bar */}
          {priceTargetData.low && priceTargetData.high && (
            <div className="relative pt-6 pb-2">
              <div className="h-3 bg-zinc-800 rounded-full relative">
                {/* Range gradient */}
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                  style={{
                    left: "0%",
                    right: "0%",
                  }}
                />
                {/* Current price marker */}
                <div
                  className="absolute w-3 h-5 bg-white rounded-sm -top-1 transform -translate-x-1/2 shadow-lg"
                  style={{
                    left: `${Math.max(0, Math.min(100, ((priceTargetData.current - priceTargetData.low) / (priceTargetData.high - priceTargetData.low)) * 100))}%`,
                  }}
                />
                {/* Target marker */}
                <div
                  className="absolute w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-emerald-400 bottom-full transform -translate-x-1/2 mb-1"
                  style={{
                    left: `${Math.max(0, Math.min(100, ((priceTargetData.target - priceTargetData.low) / (priceTargetData.high - priceTargetData.low)) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-red-400 font-mono">${priceTargetData.low.toFixed(2)}</span>
                <span className="text-zinc-500">Low / Target / High</span>
                <span className="text-emerald-400 font-mono">${priceTargetData.high.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Analyst Actions */}
      {displayedGrades.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Recent Analyst Actions
            </h3>
            <span className="text-xs text-zinc-500">
              {data.recentGrades.length} total
            </span>
          </div>
          
          <div className="divide-y divide-zinc-800/50">
            {displayedGrades.map((grade, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex-shrink-0">
                  <ActionIcon action={grade.action} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3 h-3 text-zinc-500" />
                    <span className="text-sm font-medium text-white truncate">
                      {grade.gradingCompany}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {grade.previousGrade && (
                      <>
                        <span className={cn("text-xs", getRatingColor(grade.previousGrade))}>
                          {grade.previousGrade}
                        </span>
                        <span className="text-zinc-600">→</span>
                      </>
                    )}
                    <span className={cn("text-xs font-medium", getRatingColor(grade.newGrade))}>
                      {grade.newGrade}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-xs text-zinc-500">
                    {formatRelativeDate(grade.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {data.recentGrades.length > 5 && (
            <button
              onClick={() => setShowAllGrades(!showAllGrades)}
              className="w-full p-3 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors flex items-center justify-center gap-1"
            >
              {showAllGrades ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show All ({data.recentGrades.length})
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Rating History Chart */}
      {data.ratingsHistorical && data.ratingsHistorical.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Rating Score History</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={[...data.ratingsHistorical].reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis
                domain={[1, 5]}
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 10 }}
                ticks={[1, 2, 3, 4, 5]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }}
                labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                formatter={(value: number, name: string) => {
                  const displayName = name === "overallScore" ? "Overall Score" : name;
                  return [value.toFixed(2), displayName];
                }}
              />
              <Line
                type="monotone"
                dataKey="overallScore"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 3 }}
                activeDot={{ fill: "#10b981", r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
