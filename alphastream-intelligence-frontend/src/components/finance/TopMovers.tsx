import { useEffect, useState } from "react";
import { useStockDetail } from "@/contexts/StockDetailContext";
import type { Stock } from "@/types";
import { API_BASE_URL } from "@/config/api";

type TabType = "gainers" | "losers" | "volume";

interface TopMover extends Stock {
  volume: number;
}

export function TopMovers() {
  const [activeTab, setActiveTab] = useState<TabType>("gainers");
  const [gainers, setGainers] = useState<TopMover[]>([]);
  const [losers, setLosers] = useState<TopMover[]>([]);
  const [volumeLeaders, setVolumeLeaders] = useState<TopMover[]>([]);
  const [loading, setLoading] = useState(true);
  const { openStockDetail } = useStockDetail();

  useEffect(() => {
    const fetchTopMovers = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/market/top-movers?limit=10`);
        const data = await response.json();

        setGainers(data.gainers || []);
        setLosers(data.losers || []);

        const allStocksResponse = await fetch(`${API_BASE_URL}/api/universe/core`);
        const allStocks = await allStocksResponse.json();
        const sortedByVolume = [...allStocks]
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
          .slice(0, 10);
        setVolumeLeaders(sortedByVolume);
      } catch (error) {
        console.error("Error fetching top movers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopMovers();
    const interval = setInterval(fetchTopMovers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const data =
    activeTab === "gainers" ? gainers : activeTab === "losers" ? losers : volumeLeaders;

  if (loading) {
    return (
      <div className="bg-sidebar-accent rounded-xl p-6 border border-border h-full">
        <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-page-heading)' }}>Top Movers</h2>
        <div className="text-muted-foreground animate-[pf-shimmer_2s_ease-in-out_infinite]">Loading movers...</div>
      </div>
    );
  }

  return (
    <div className="bg-sidebar-accent rounded-xl p-6 border border-border h-full">
      <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-page-heading)' }}>Top Movers</h2>

      <div className="flex gap-1.5 mb-4 p-1 bg-sidebar rounded-lg w-fit border border-border">
        {(["gainers", "losers", "volume"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-pf-spring active:scale-95 ${
              activeTab === tab
                ? tab === "gainers"
                  ? "bg-positive/20 text-positive border border-positive/30"
                  : tab === "losers"
                  ? "bg-negative/20 text-negative border border-negative/30"
                  : "bg-primary/20 text-primary border border-primary/30"
                : "text-dim hover:text-muted-foreground"
            }`}
          >
            {tab === "gainers" ? "Gainers" : tab === "losers" ? "Losers" : "Volume"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {data.map((stock) => (
          <div
            key={stock.ticker}
            onClick={() => openStockDetail(stock)}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors duration-200"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-sidebar-foreground">{stock.ticker}</span>
                <span className="text-xs text-muted-foreground">{stock.name}</span>
              </div>
              <span className="text-xs text-dim">{stock.sector}</span>
            </div>
            <div className="text-right">
              {activeTab === "volume" ? (
                <span className="text-sm font-medium text-blue-400">
                  {(stock.volume / 1_000_000).toFixed(1)}M
                </span>
              ) : (
                <span
                  className={`text-sm font-medium ${
                    (stock.change1D ?? 0) >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {(stock.change1D ?? 0) >= 0 ? "+" : ""}
                  {(stock.change1D ?? 0).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

