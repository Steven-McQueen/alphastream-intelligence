import { useEffect, useState } from "react";

interface SectorData {
  sector: string;
  change1D: number;
  change1W: number;
  change1M: number;
  stockCount: number;
}

type TimeFrame = "1D" | "1W" | "1M";

export function SectorPerformance() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1D");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        setLoading(true);
        const response = await fetch("http://localhost:8000/api/market/sectors");
        const data = await response.json();
        setSectors(data);
      } catch (error) {
        console.error("Error fetching sectors:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSectors();
    const interval = setInterval(fetchSectors, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getChangeForTimeFrame = (sector: SectorData) => {
    switch (timeFrame) {
      case "1W":
        return sector.change1W;
      case "1M":
        return sector.change1M;
      case "1D":
      default:
        return sector.change1D;
    }
  };

  const getColorClass = (change: number) => {
    if (change > 0) return "bg-green-900/50 border-green-700";
    if (change < 0) return "bg-red-900/50 border-red-700";
    return "bg-zinc-800/50 border-zinc-700";
  };

  const getTextColorClass = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-zinc-400";
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50 h-full">
        <h2 className="text-lg font-semibold text-white mb-4">Sector Performance</h2>
        <div className="text-zinc-400 animate-pulse">Loading sectors...</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Sector Performance</h2>
        <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-lg">
          {(["1D", "1W", "1M"] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                timeFrame === tf ? "bg-cyan-500/20 text-cyan-400" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tf}
          </button>
        ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {sectors.map((sector) => {
          const change = getChangeForTimeFrame(sector);
          const isPositive = change >= 0;
          return (
            <div
              key={sector.sector}
              className="p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <div className="text-xs font-medium text-zinc-400 mb-1 truncate">{sector.sector}</div>
              <div className={`text-base font-semibold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? "+" : ""}
                {change.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

