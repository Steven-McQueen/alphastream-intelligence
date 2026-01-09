import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useStockDetail } from "@/contexts/StockDetailContext";
import type { Stock } from "@/types";

interface WatchlistStock extends Stock {
  tags?: string[];
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
        const stocksWithTags = (data || []).map((stock: Stock) => ({
          ...stock,
          tags: [],
        }));
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
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">My Watchlist</h2>
        </div>
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">My Watchlist</h2>
          <button
            onClick={() => navigate("/watchlist")}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Open full watchlist →
          </button>
        </div>
        <div className="text-zinc-400 text-center py-8">
          No stocks in watchlist. Add stocks to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">My Watchlist</h2>
        <button
          onClick={() => navigate("/watchlist")}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          Open full watchlist
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <th className="text-left text-xs font-medium text-zinc-400 pb-2">Sector</th>
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
                <td className="py-3 text-sm text-zinc-400">{stock.sector}</td>
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

