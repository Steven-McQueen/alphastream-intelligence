import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings, Star, X, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStockDetail } from "@/contexts/StockDetailContext";
import { WatchlistChart } from "@/components/charts/WatchlistChart";
import { WatchlistNews } from "@/components/screener/WatchlistNews";
import type { Stock } from "@/types";

const API_BASE_URL = "http://localhost:8000";
// Format large numbers (Market Cap, etc.)
function formatLargeNumber(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const absValue = Math.abs(value);
  if (absValue >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (absValue >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (absValue >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (absValue >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

type SortColumn = "price" | "change1D" | "marketCap" | "peRatio" | "roe";
type SortDirection = "asc" | "desc";

export default function WatchlistPage() {
  const { watchlist, toggleWatchlist } = useWatchlist();
  const { openStockDetail } = useStockDetail();
  const [sortColumn, setSortColumn] = useState<SortColumn>("change1D");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [displayCount, setDisplayCount] = useState(25);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockLogos, setStockLogos] = useState<Record<string, string>>({});
  const [stockMetrics, setStockMetrics] = useState<Record<string, {
    beta?: number;
    roe?: number;
    grossMargin?: number;
    netMargin?: number;
  }>>({});

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
    await new Promise((resolve) => setTimeout(resolve, 400));
    setLastUpdated(new Date());
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

  // Fetch logos and metrics for watchlist stocks
  useEffect(() => {
    const fetchProfileData = async () => {
      const newLogos: Record<string, string> = {};
      const newMetrics: Record<string, { beta?: number; roe?: number; grossMargin?: number; netMargin?: number }> = {};
      
      for (const ticker of watchlist) {
        if (stockLogos[ticker] && stockMetrics[ticker]) continue;
        try {
          const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/profile`);
          if (res.ok) {
            const profile = await res.json();
            if (profile.image && !stockLogos[ticker]) {
              newLogos[ticker] = profile.image;
            }
            // Extract metrics from profile (FMP profile includes these)
            if (!stockMetrics[ticker]) {
              newMetrics[ticker] = {
                beta: profile.beta,
                // Note: FMP profile doesn't include margins/ROE directly
                // These would need key-metrics endpoint, but beta is in profile
              };
            }
          }
        } catch {
          // Ignore errors
        }
      }
      if (Object.keys(newLogos).length > 0) {
        setStockLogos(prev => ({ ...prev, ...newLogos }));
      }
      if (Object.keys(newMetrics).length > 0) {
        setStockMetrics(prev => ({ ...prev, ...newMetrics }));
      }
    };
    fetchProfileData();
  }, [watchlist, stockLogos, stockMetrics]);

  // Filter stocks for search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return stocks
      .filter(s => 
        !watchlist.includes(s.ticker) && 
        (s.ticker.toLowerCase().includes(query) || s.name.toLowerCase().includes(query))
      )
      .slice(0, 10);
  }, [stocks, searchQuery, watchlist]);

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
      {/* Summary Header */}
      <section className="px-6 pt-6 pb-4">
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-emerald-900/20 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">My Watchlist</h1>
                <p className="text-sm text-zinc-400">
                  Track {watchlistStocks.length} stocks • Last updated {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="px-6 py-4">
        <div className="flex items-center justify-end mb-4">
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
                    {formatLargeNumber(stock.marketCap ?? 0)}
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
                    {(stock.beta || stockMetrics[stock.ticker]?.beta) 
                      ? (stock.beta || stockMetrics[stock.ticker]?.beta)?.toFixed(2) 
                      : "N/A"}
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

      {/* Performance Comparison Chart */}
      <section className="px-6 py-4">
        <WatchlistChart tickers={watchlist} maxStocks={8} />
      </section>

      {/* News */}
      <section className="px-6 py-4 pb-8">
        <WatchlistNews tickers={watchlist} maxArticles={12} />
      </section>

      {/* Manage modal */}
      <Dialog open={isManageModalOpen} onOpenChange={(open) => {
        setIsManageModalOpen(open);
        if (!open) setSearchQuery("");
      }}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Manage Watchlist</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Add or remove tickers from your watchlist.
            </DialogDescription>
          </DialogHeader>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stocks to add..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border border-zinc-700 rounded-lg bg-zinc-800/50 max-h-40 overflow-y-auto">
              {searchResults.map((stock) => (
                <button
                  key={stock.ticker}
                  onClick={() => {
                    toggleWatchlist(stock.ticker);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-zinc-700/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {stockLogos[stock.ticker] ? (
                        <img 
                          src={stockLogos[stock.ticker]} 
                          alt={stock.ticker}
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">{stock.ticker.slice(0, 2)}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{stock.ticker}</div>
                      <div className="text-xs text-zinc-500 truncate max-w-[200px]">{stock.name}</div>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-emerald-500" />
                </button>
              ))}
            </div>
          )}
          
          {/* Current Watchlist */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Current Watchlist ({watchlist.length})
            </div>
            {watchlist.map((ticker) => {
              const stock = watchlistStocks.find((s) => s.ticker === ticker);
              return (
                <div key={ticker} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 group">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 cursor-grab">⋮⋮</div>
                    <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {stockLogos[ticker] ? (
                        <img 
                          src={stockLogos[ticker]} 
                          alt={ticker}
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">{ticker.slice(0, 2)}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{ticker}</div>
                      <div className="text-xs text-zinc-500">{stock?.name ?? "Not loaded"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWatchlist(ticker)}
                    className="text-zinc-500 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {watchlist.length === 0 && (
              <div className="text-center py-8 text-zinc-500 text-sm">
                Your watchlist is empty. Search for stocks above to add them.
              </div>
            )}
          </div>
          
          <DialogFooter>
            <button
              onClick={() => {
                setIsManageModalOpen(false);
                setSearchQuery("");
              }}
              className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

