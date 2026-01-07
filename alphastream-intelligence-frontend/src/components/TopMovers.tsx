import { useEffect, useState } from "react";
import { useStockDetail } from "@/contexts/StockDetailContext";
import type { Stock } from "@/types";

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
        const response = await fetch("http://localhost:8000/api/market/top-movers?limit=10");
        const data = await response.json();

        setGainers(data.gainers || []);
        setLosers(data.losers || []);

        const allStocksResponse = await fetch("http://localhost:8000/api/universe/core");
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
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <h2 className="text-lg font-semibold text-white mb-4">Top Movers</h2>
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
      <h2 className="text-lg font-semibold text-white mb-4">Top Movers</h2>

      <div className="flex gap-2 mb-4">
        {(["gainers", "losers", "volume"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? tab === "gainers"
                  ? "bg-green-600 text-white"
                  : tab === "losers"
                  ? "bg-red-600 text-white"
                  : "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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
            className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{stock.ticker}</span>
                <span className="text-xs text-zinc-400">{stock.name}</span>
              </div>
              <span className="text-xs text-zinc-500">{stock.sector}</span>
            </div>
            <div className="text-right">
              {activeTab === "volume" ? (
                <span className="text-sm font-medium text-blue-400">
                  {(stock.volume / 1_000_000).toFixed(1)}M
                </span>
              ) : (
                <span
                  className={`text-sm font-medium ${
                    (stock.change1D ?? 0) >= 0 ? "text-green-500" : "text-red-500"
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

