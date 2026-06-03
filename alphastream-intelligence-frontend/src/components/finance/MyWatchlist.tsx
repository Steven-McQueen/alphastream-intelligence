import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useStockDetail } from "@/contexts/StockDetailContext";
import type { Stock } from "@/types";
import { API_BASE_URL } from "@/config/api";

interface WatchlistStock extends Stock {
  tags?: string[];
  peRatio?: number | null;
  roe?: number | null;
  grossMargin?: number | null;
  netMargin?: number | null;
  beta?: number | null;
  marketCap?: number | null;
}

export function MyWatchlist() {
  const navigate = useNavigate();
  const { watchlist } = useWatchlist();
  const { openStockDetail, subscribeToStockUpdates } = useStockDetail();
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
        const response = await fetch(`${API_BASE_URL}/api/watchlist/prices?${params.toString()}`);
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

  // Subscribe to stock updates from StockDetailSheet
  useEffect(() => {
    const unsubscribe = subscribeToStockUpdates((updatedStock) => {
      setStocks(prev => prev.map(s =>
        s.ticker === updatedStock.ticker ? { ...s, ...updatedStock } : s
      ));
    });
    return unsubscribe;
  }, [subscribeToStockUpdates]);

  if (loading) {
    return (
      <div className="bg-sidebar-accent rounded-xl p-6 border border-border">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-1 bg-[var(--text-author)] rounded-full" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-page-heading)' }}>My Watchlist</h2>
          </div>
        </div>
        <div className="text-muted-foreground animate-[pf-shimmer_2s_ease-in-out_infinite]">Loading watchlist...</div>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-sidebar-accent rounded-xl p-6 border border-border">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-1 bg-[var(--text-author)] rounded-full" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-page-heading)' }}>My Watchlist</h2>
          </div>
          <button
            onClick={() => navigate("/watchlist")}
            className="text-sm text-dim hover:text-muted-foreground transition-colors duration-100"
          >
            Manage Watchlist →
          </button>
        </div>
        <div className="text-dim text-center py-12 bg-sidebar-accent rounded-lg border border-border">
          <p className="mb-2">Your watchlist is empty</p>
          <p className="text-xs text-dim">Add stocks from the screener to track them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sidebar-accent rounded-xl p-6 border border-border">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-1 bg-[var(--text-author)] rounded-full" />
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-page-heading)' }}>My Watchlist</h2>
          <span className="text-xs text-dim bg-muted px-2 py-1 rounded-full">{stocks.length} stocks</span>
        </div>
        <button
          onClick={() => navigate("/watchlist")}
          className="text-sm text-dim hover:text-muted-foreground transition-all duration-100 flex items-center gap-1.5 border border-border hover:border-secondary px-3 py-1.5 rounded-lg"
        >
          Manage
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left text-xs font-medium text-dim pb-2">Ticker</th>
              <th className="text-right text-xs font-medium text-dim pb-2">Mkt Cap</th>
              <th className="text-right text-xs font-medium text-dim pb-2">1D %</th>
              <th className="text-right text-xs font-medium text-dim pb-2">1W %</th>
              <th className="text-right text-xs font-medium text-dim pb-2">P/E</th>
              <th className="text-right text-xs font-medium text-dim pb-2">ROE</th>
              <th className="text-right text-xs font-medium text-dim pb-2">Gross %</th>
              <th className="text-right text-xs font-medium text-dim pb-2">Net %</th>
              <th className="text-right text-xs font-medium text-dim pb-2">Beta</th>
              <th className="text-right text-xs font-medium text-dim pb-2">Volume</th>
              <th className="text-left text-xs font-medium text-dim pb-2">Tags</th>
            </tr>
          </thead>
          <tbody>
            {stocks.slice(0, 8).map((stock) => (
              <tr
                key={stock.ticker}
                onClick={() => openStockDetail(stock)}
                className="border-b border-border/50 hover:bg-muted cursor-pointer transition-colors duration-200"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        (stock.change1D ?? 0) >= 0 ? "bg-positive" : "bg-negative"
                      }`}
                    />
                    <span className="text-sm font-medium text-sidebar-foreground">{stock.ticker}</span>
                  </div>
                </td>
                <td className="py-3 text-right text-sm text-muted-foreground font-mono">
                  {stock.marketCap != null
                    ? stock.marketCap >= 1e12
                      ? `$${(stock.marketCap / 1e12).toFixed(1)}T`
                      : stock.marketCap >= 1e9
                        ? `$${(stock.marketCap / 1e9).toFixed(1)}B`
                        : stock.marketCap >= 1e6
                          ? `$${(stock.marketCap / 1e6).toFixed(0)}M`
                          : `$${stock.marketCap.toLocaleString()}`
                    : "—"}
                </td>
                <td
                  className={`py-3 text-right text-sm font-medium ${
                    (stock.change1D ?? 0) >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {(stock.change1D ?? 0) >= 0 ? "+" : ""}
                  {(stock.change1D ?? 0).toFixed(2)}%
                </td>
                <td
                  className={`py-3 text-right text-sm ${
                    (stock.change1W ?? 0) >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {(stock.change1W ?? 0) >= 0 ? "+" : ""}
                  {(stock.change1W ?? 0).toFixed(2)}%
                </td>
                <td className="py-3 text-right text-sm text-muted-foreground font-mono">
                  {stock.peRatio != null ? stock.peRatio.toFixed(1) : "—"}
                </td>
                <td className="py-3 text-right text-sm text-muted-foreground font-mono">
                  {stock.roe != null ? `${(stock.roe * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-3 text-right text-sm text-muted-foreground font-mono">
                  {stock.grossMargin != null ? `${(stock.grossMargin * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-3 text-right text-sm text-muted-foreground font-mono">
                  {stock.netMargin != null ? `${(stock.netMargin * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-3 text-right text-sm text-muted-foreground font-mono">
                  {stock.beta != null ? stock.beta.toFixed(2) : "—"}
                </td>
                <td className="py-3 text-right text-sm text-dim font-mono">
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
                          className="px-2 py-1 text-xs rounded-full bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))] border border-[hsl(var(--chart-3))]/20"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-dim">—</span>
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

