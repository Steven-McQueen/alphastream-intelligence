import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings, Star, Newspaper, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStockDetail } from "@/contexts/StockDetailContext";
import type { Stock } from "@/types";

const API_BASE_URL = "http://localhost:8000";
const MOCK_SUMMARY = `Watchlist is loading live data from the AlphaStream backend (SQLite cache).`;
const EMPTY_NEWS: { id: string; headline: string; summary: string; source: string; timestamp: string; url?: string }[] = [];

type SortColumn = "price" | "change1D" | "marketCap" | "peRatio" | "roe";
type SortDirection = "asc" | "desc";

export default function WatchlistPage() {
  const { watchlist, toggleWatchlist } = useWatchlist();
  const { openStockDetail } = useStockDetail();
  const [sortColumn, setSortColumn] = useState<SortColumn>("change1D");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [displayCount, setDisplayCount] = useState(25);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summaryText, setSummaryText] = useState(MOCK_SUMMARY);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("1D");
  const [compareMode, setCompareMode] = useState("top-movers");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/universe/core`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setStocks(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching stocks:", err);
        setError("Failed to load stocks. Ensure the backend is running on port 8000.");
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
    const interval = setInterval(fetchStocks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setDisplayCount(25);
  }, [watchlist]);

  const watchlistStocks = useMemo(
    () => stocks.filter((s) => watchlist.includes(s.ticker)),
    [stocks, watchlist]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSummaryText("Refreshing data from backend...");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSummaryText(MOCK_SUMMARY);
    setIsRefreshing(false);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedWatchlistStocks = useMemo(() => {
    return [...watchlistStocks].sort((a, b) => {
      const valueFor = (col: SortColumn, stock: Stock) => {
        switch (col) {
          case "price":
            return stock.price ?? 0;
          case "change1D":
            return stock.change1D ?? 0;
          case "marketCap":
            return stock.marketCap ?? 0;
          case "peRatio":
            return stock.peRatio ?? 0;
          case "roe":
            return stock.roe ?? 0;
          default:
            return 0;
        }
      };
      const aVal = valueFor(sortColumn, a);
      const bVal = valueFor(sortColumn, b);
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [watchlistStocks, sortColumn, sortDirection]);

  const chartData = [
    { time: "9:30", A: 0, B: 0, C: 0, D: 0 },
    { time: "10:30", A: 1.2, B: 0.6, C: 0.4, D: -0.5 },
    { time: "11:30", A: 2.4, B: 1.1, C: 0.9, D: -0.8 },
    { time: "12:30", A: 3.8, B: 1.9, C: 1.4, D: -1.2 },
    { time: "13:30", A: 4.5, B: 2.5, C: 1.9, D: -1.5 },
    { time: "14:30", A: 5.2, B: 3.1, C: 2.4, D: -1.7 },
    { time: "15:30", A: 6.0, B: 3.8, C: 2.9, D: -2.0 },
  ];
  const chartLines = [
    { key: "A", label: "Top Gainer 1", color: "#06b6d4" },
    { key: "B", label: "Top Gainer 2", color: "#f59e0b" },
    { key: "C", label: "Top Gainer 3", color: "#10b981" },
    { key: "D", label: "Top Loser 1", color: "#ef4444" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">Loading stocks...</div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      {/* Summary */}
      <section className="px-6 pt-6 pb-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="absolute top-4 right-4 flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Updated now
          </button>
          <p className="text-sm text-zinc-300 leading-relaxed pr-24">{summaryText}</p>
        </div>
      </section>

      {/* Table */}
      <section className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">My Watchlist</h2>
          <button
            onClick={() => setIsManageModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Manage Watchlist
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Ticker</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Change 1D</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Market Cap</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">P/E</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">ROE</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Gross Margin</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Net Margin</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Beta</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Volume</th>
              </tr>
            </thead>
            <tbody>
              {sortedWatchlistStocks.slice(0, displayCount).map((stock) => (
                <tr
                  key={stock.ticker}
                  onClick={() => openStockDetail(stock)}
                  className="border-b border-zinc-800 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-white flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlist(stock.ticker);
                      }}
                      className="group"
                    >
                      <Star className={cn(
                        "w-4 h-4",
                        watchlist.includes(stock.ticker) ? "fill-yellow-500 text-yellow-500" : "text-zinc-500"
                      )} />
                    </button>
                    {stock.ticker}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{stock.name}</td>
                  <td className="px-4 py-3 text-sm text-white">${(stock.price ?? 0).toFixed(2)}</td>
                  <td className={cn("px-4 py-3 text-sm text-right", (stock.change1D ?? 0) >= 0 ? "text-green-500" : "text-red-500")}>
                    {(stock.change1D ?? 0) >= 0 ? "+" : ""}{(stock.change1D ?? 0).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">
                    ${((stock.marketCap ?? 0) / 1000).toFixed(1)}B
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">
                    {stock.peRatio ? stock.peRatio.toFixed(2) : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">
                    {stock.roe ? `${stock.roe.toFixed(1)}%` : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">
                    {stock.grossMargin ? `${stock.grossMargin.toFixed(1)}%` : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">
                    {stock.netProfitMargin ? `${stock.netProfitMargin.toFixed(1)}%` : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">
                    {stock.beta ? stock.beta.toFixed(2) : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-300">
                    {((stock.volume ?? 0) / 1_000_000).toFixed(2)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayCount < watchlistStocks.length && (
            <div className="p-4 border-top border-zinc-800 text-center">
              <button
                onClick={() => setDisplayCount((prev) => prev + 25)}
                className="text-sm text-zinc-400 hover:text-white font-medium"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Movers placeholder chart */}
      <section className="px-6 py-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Watchlist Movers</h3>
            <div className="flex items-center gap-2">
              {['1D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'].map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                    chartPeriod === period
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                  )}
                >
                  {period}
                </button>
              ))}
              <Select value={compareMode} onValueChange={setCompareMode}>
                <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-zinc-300 text-xs">
                  <SelectValue placeholder="Compare" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="top-movers">Top Movers</SelectItem>
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="h-80 relative bg-[#0f0f11] border border-zinc-800 rounded-lg p-4">
            <svg viewBox="0 0 100 80" className="w-full h-full">
              <g stroke="#27272a" strokeDasharray="3 3">
                <line x1="0" x2="100" y1="20" y2="20" />
                <line x1="0" x2="100" y1="40" y2="40" />
                <line x1="0" x2="100" y1="60" y2="60" />
              </g>
              {chartLines.map((line, idx) => (
                <polyline
                  key={line.key}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="1.5"
                  points={chartData.map((row, i) => `${(i / (chartData.length - 1)) * 100},${60 - (row[line.key as keyof typeof row] as number) * 3}`).join(' ')}
                />
              ))}
            </svg>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {chartLines.map((line) => (
              <div key={line.key} className="flex items-center gap-2">
                <div className="w-3 h-0.5" style={{ backgroundColor: line.color }} />
                <span className="text-xs text-zinc-300">{line.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News */}
      <section className="px-6 py-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Newspaper className="w-5 h-5" />
            Watchlist News
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(EMPTY_NEWS.length ? EMPTY_NEWS : []).map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded bg-zinc-700" />
                <span className="text-xs text-zinc-500">{article.source}</span>
                <span className="text-xs text-zinc-600">·</span>
                <span className="text-xs text-zinc-500">{article.timestamp}</span>
              </div>
              <h4 className="text-sm font-medium text-white leading-snug mb-2 group-hover:text-emerald-500 transition-colors">
                {article.headline}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                {article.summary}
              </p>
            </a>
            ))}
          {EMPTY_NEWS.length === 0 && (
            <div className="text-sm text-zinc-500">News not available yet.</div>
          )}
        </div>
      </section>

      {/* Manage modal */}
      <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Manage Watchlist</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Add or remove tickers from your watchlist.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {watchlist.map((ticker) => {
              const stock = watchlistStocks.find((s) => s.ticker === ticker);
              return (
                <div key={ticker} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 group">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400">⋮⋮</div>
                    <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center text-xs text-zinc-300">
                      {ticker.slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{ticker}</div>
                      <div className="text-xs text-zinc-500">{stock?.name ?? "Not loaded"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWatchlist(ticker)}
                    className="text-zinc-500 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsManageModalOpen(false)}
              className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-lg font-medium"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

