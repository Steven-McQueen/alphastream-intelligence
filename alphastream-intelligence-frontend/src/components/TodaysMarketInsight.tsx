import { useEffect, useState } from "react";

interface SectorData {
  sector: string;
  change1D: number;
}

export function TodaysMarketInsight() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      try {
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
  }, []);

  const getSectorColor = (name: string) => {
    const s = sectors.find((x) => x.sector === name);
    if (!s) return "text-zinc-400";
    return (s.change1D ?? 0) >= 0 ? "text-green-500" : "text-red-500";
  };

  const getSectorChange = (name: string) => {
    const s = sectors.find((x) => x.sector === name);
    if (!s) return "0.00";
    return ((s.change1D ?? 0) >= 0 ? "+" : "") + (s.change1D ?? 0).toFixed(2);
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-4">Today&apos;s Market</h2>
      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : (
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <p>
            Markets showed mixed signals today as investors weighed economic data.{" "}
            <span className={getSectorColor("Technology")}>
              Technology ({getSectorChange("Technology")}%)
            </span>{" "}
            led the session, while{" "}
            <span className={getSectorColor("Financials")}>
              Financials ({getSectorChange("Financials")}%)
            </span>{" "}
            and{" "}
            <span className={getSectorColor("Energy")}>
              Energy ({getSectorChange("Energy")}%)
            </span>{" "}
            sectors showed relative weakness.
          </p>

          <p>
            <span className={getSectorColor("Healthcare")}>
              Healthcare ({getSectorChange("Healthcare")}%)
            </span>{" "}
            and{" "}
            <span className={getSectorColor("Consumer Discretionary")}>
              Consumer Discretionary ({getSectorChange("Consumer Discretionary")}%)
            </span>{" "}
            sectors demonstrated resilience. The market breadth remained constructive with
            advancing issues outnumbering decliners.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {sectors.slice(0, 8).map((sector) => (
              <div
                key={sector.sector}
                className={`p-3 rounded-lg ${
                  (sector.change1D ?? 0) >= 0
                    ? "bg-green-900/20 border border-green-800/30"
                    : "bg-red-900/20 border border-red-800/30"
                }`}
              >
                <div className="text-xs text-zinc-400 mb-1">{sector.sector}</div>
                <div
                  className={`text-sm font-semibold ${
                    (sector.change1D ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {(sector.change1D ?? 0) >= 0 ? "+" : ""}
                  {(sector.change1D ?? 0).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

