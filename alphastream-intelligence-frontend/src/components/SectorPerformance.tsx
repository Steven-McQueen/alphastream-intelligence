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
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <h2 className="text-lg font-semibold text-white mb-4">Sector Performance</h2>
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
      <h2 className="text-lg font-semibold text-white mb-4">Sector Performance</h2>

      <div className="flex gap-2 mb-4">
        {(["1D", "1W", "1M"] as TimeFrame[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeFrame(tf)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              timeFrame === tf ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {sectors.map((sector) => {
          const change = getChangeForTimeFrame(sector);
          return (
            <div
              key={sector.sector}
              className={`p-4 rounded-lg border transition-colors ${getColorClass(change)}`}
            >
              <div className="text-sm font-medium text-white mb-1">{sector.sector}</div>
              <div className={`text-lg font-semibold ${getTextColorClass(change)}`}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

