import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useStockDetail } from "@/contexts/StockDetailContext";
import type { Stock } from "@/types";

interface WatchlistStock extends Stock {
  tags?: string[];
  peRatio?: number | null;
  roe?: number | null;
  grossMargin?: number | null;
  netMargin?: number | null;
  beta?: number | null;
}

export function MyWatchlist() {
  const navigate = useNavigate();
  const { watchlist } = useWatchlist();
  const { openStockDetail } = useStockDetail();
  const [stocks, setStocks] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchlistStocks = async () => {
      if (watchlist.length === 0) {
        setStocks([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const params = new URLSearchParams({ tickers: watchlist.join(",") });
        const response = await fetch(`http://localhost:8000/api/watchlist/prices?${params.toString()}`);
        const data = await response.json();

        // Determine tags based on stock characteristics
        const stocksWithTags = (data || []).map((stock: Stock) => {
          const tags: string[] = [];

          // High momentum if 1D change > 3%
          if (Math.abs(stock.change1D ?? 0) > 3) {
            tags.push('High Vol');
          }

          // Growth stock if no dividend yield
          if ((stock.dividendYield ?? 0) === 0) {
            tags.push('Growth');
          }

          // Dividend stock if yield > 2%
          if ((stock.dividendYield ?? 0) > 2) {
            tags.push('Dividend');
          }

          // Value stock if PE < 15
          if ((stock.peRatio ?? 999) < 15 && stock.peRatio) {
            tags.push('Value');
          }

          return {
            ...stock,
            tags: tags.slice(0, 2), // Limit to 2 tags
          };
        });
        setStocks(stocksWithTags);
      } catch (error) {
        console.error("Error fetching watchlist stocks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlistStocks();
  }, [watchlist]);

  if (loading) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-1 bg-yellow-500 rounded-full" />
            <h2 className="text-lg font-semibold text-white">My Watchlist</h2>
          </div>
        </div>
        <div className="text-zinc-400 animate-pulse">Loading watchlist...</div>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-1 bg-yellow-500 rounded-full" />
            <h2 className="text-lg font-semibold text-white">My Watchlist</h2>
          </div>
          <button
            onClick={() => navigate("/watchlist")}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Manage Watchlist →
          </button>
        </div>
        <div className="text-zinc-500 text-center py-12 bg-zinc-800/30 rounded-lg">
          <p className="mb-2">Your watchlist is empty</p>
          <p className="text-xs">Add stocks from the screener to track them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-1 bg-yellow-500 rounded-full" />
          <h2 className="text-lg font-semibold text-white">My Watchlist</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">{stocks.length} stocks</span>
        </div>
        <button
          onClick={() => navigate("/watchlist")}
          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 bg-zinc-800/50 px-3 py-1.5 rounded-lg hover:bg-zinc-800"
        >
          Manage
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="text-left text-xs font-medium text-zinc-400 pb-2">Ticker</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">1D %</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">1W %</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">P/E</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">ROE</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">Gross %</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">Net %</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">Beta</th>
              <th className="text-right text-xs font-medium text-zinc-400 pb-2">Volume</th>
              <th className="text-left text-xs font-medium text-zinc-400 pb-2">Tags</th>
            </tr>
          </thead>
          <tbody>
            {stocks.slice(0, 8).map((stock) => (
              <tr
                key={stock.ticker}
                onClick={() => openStockDetail(stock)}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        (stock.change1D ?? 0) >= 0 ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="text-sm font-medium text-white">{stock.ticker}</span>
                  </div>
                </td>
                <td
                  className={`py-3 text-right text-sm font-medium ${
                    (stock.change1D ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {(stock.change1D ?? 0) >= 0 ? "+" : ""}
                  {(stock.change1D ?? 0).toFixed(2)}%
                </td>
                <td
                  className={`py-3 text-right text-sm ${
                    (stock.change1W ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {(stock.change1W ?? 0) >= 0 ? "+" : ""}
                  {(stock.change1W ?? 0).toFixed(2)}%
                </td>
                <td className="py-3 text-right text-sm text-zinc-300 font-mono">
                  {stock.peRatio != null ? stock.peRatio.toFixed(1) : "—"}
                </td>
                <td className="py-3 text-right text-sm text-zinc-300 font-mono">
                  {stock.roe != null ? `${(stock.roe * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-3 text-right text-sm text-zinc-300 font-mono">
                  {stock.grossMargin != null ? `${(stock.grossMargin * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-3 text-right text-sm text-zinc-300 font-mono">
                  {stock.netMargin != null ? `${(stock.netMargin * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-3 text-right text-sm text-zinc-300 font-mono">
                  {stock.beta != null ? stock.beta.toFixed(2) : "—"}
                </td>
                <td className="py-3 text-right text-sm text-zinc-400 font-mono">
                  {stock.volume != null
                    ? stock.volume >= 1000000
                      ? `${(stock.volume / 1000000).toFixed(1)}M`
                      : stock.volume >= 1000
                        ? `${(stock.volume / 1000).toFixed(0)}K`
                        : stock.volume.toLocaleString()
                    : "—"}
                </td>
                <td className="py-3">
                  <div className="flex gap-1">
                    {stock.tags && stock.tags.length > 0 ? (
                      stock.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs rounded-full bg-blue-900/50 text-blue-400"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

