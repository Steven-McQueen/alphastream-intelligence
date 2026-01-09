import { useEffect, useState } from "react";

interface InsightResponse {
  status: string;
  marketTone: string;
  leaders: { sector: string; change1D: number }[];
  laggards: { sector: string; change1D: number }[];
  text: string;
  last_updated: string;
}

export function TodaysMarketInsight() {
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/market/todays-insight");
        const data = await response.json();
        setInsight(data);
      } catch (error) {
        console.error("Error fetching insight:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInsight();
  }, []);

  const pill = (label: string, value: string) => (
    <span className="px-2 py-1 text-xs rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700">
      {label}: {value}
    </span>
  );

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-4">Today&apos;s Market</h2>
      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : (
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <div className="flex flex-wrap gap-2">
            {pill("Session", insight?.status ?? "Unknown")}
            {pill("Tone", insight?.marketTone ?? "Neutral")}
          </div>
          <p>{insight?.text ?? "No data available."}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {insight?.leaders?.map((sector) => (
              <div
                key={sector.sector}
                className="p-3 rounded-lg bg-green-900/20 border border-green-800/30"
              >
                <div className="text-xs text-zinc-400 mb-1">{sector.sector}</div>
                <div className="text-sm font-semibold text-green-500">
                  {(sector.change1D ?? 0) >= 0 ? "+" : ""}
                  {(sector.change1D ?? 0).toFixed(2)}%
                </div>
              </div>
            ))}
            {insight?.laggards?.map((sector) => (
              <div
                key={sector.sector}
                className="p-3 rounded-lg bg-red-900/20 border border-red-800/30"
              >
                <div className="text-xs text-zinc-400 mb-1">{sector.sector}</div>
                <div className="text-sm font-semibold text-red-500">
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

