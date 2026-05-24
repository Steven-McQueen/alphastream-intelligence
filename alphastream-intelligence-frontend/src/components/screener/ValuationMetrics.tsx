import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/config/api";

interface ValuationMetricsProps {
  ticker: string;
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border border-border/50">
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span className="text-sm font-semibold text-foreground font-mono">{value}</span>
    </div>
  );
}

function formatRatio(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return v.toFixed(2) + "x";
}

function formatPercent(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return (v * 100).toFixed(2) + "%";
}

function formatCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "$" + v.toFixed(2);
}

export function ValuationMetrics({ ticker }: ValuationMetricsProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [ratios, setRatios] = useState<any>(null);
  const [evToEbit, setEvToEbit] = useState<number | null>(null);
  const [epsDiluted, setEpsDiluted] = useState<number | null>(null);
  const [revenueGrowth, setRevenueGrowth] = useState<number | null>(null);
  const [fcfConversion, setFcfConversion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [metricsRes, incomeRes, ratiosRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/stock/${ticker}/financials/metrics?period=annual&limit=1`),
          fetch(`${API_BASE_URL}/api/stock/${ticker}/financials/income?period=annual&limit=2`),
          fetch(`${API_BASE_URL}/api/stock/${ticker}/financials/ratios?period=annual&limit=1`),
        ]);

        let incomeData: any[] = [];
        if (incomeRes.ok) {
          incomeData = await incomeRes.json();
        }

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          if (metricsData?.length > 0) {
            const m = metricsData[0];
            setMetrics(m);

            // EV/EBIT = Enterprise Value / Operating Income
            const ev = m.enterpriseValue;
            const ebit = incomeData?.[0]?.operatingIncome;
            if (ev && ebit && ebit !== 0) {
              setEvToEbit(ev / ebit);
            }

            // FCF Conversion = FCF / Net Income (derived from yields)
            if (m.freeCashFlowYield && m.earningsYield && m.earningsYield !== 0) {
              setFcfConversion(m.freeCashFlowYield / m.earningsYield);
            }
          }
        }

        if (ratiosRes.ok) {
          const ratiosData = await ratiosRes.json();
          if (ratiosData?.length > 0) {
            setRatios(ratiosData[0]);
          }
        }

        // EPS (diluted) from income statement
        if (incomeData?.[0]?.epsDiluted != null) {
          setEpsDiluted(incomeData[0].epsDiluted);
        }

        // Revenue growth TTM = (current - prior) / prior
        if (incomeData?.length >= 2) {
          const cur = incomeData[0]?.revenue;
          const prev = incomeData[1]?.revenue;
          if (cur && prev && prev !== 0) {
            setRevenueGrowth((cur - prev) / prev);
          }
        }
      } catch (err) {
        console.error("Error fetching valuation metrics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center h-20">
          <Loader2 className="w-5 h-5 animate-spin text-dim" />
        </div>
      </div>
    );
  }

  if (!metrics && !ratios) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 tracking-tight">
        Valuation
      </h3>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricCard label="P/E Ratio" value={formatRatio(ratios?.priceToEarningsRatio)} />
        <MetricCard label="P/FCF Ratio" value={formatRatio(ratios?.priceToFreeCashFlowRatio)} />
        <MetricCard label="PEG Ratio" value={formatRatio(ratios?.priceToEarningsGrowthRatio)} />
        <MetricCard label="EV / EBIT" value={formatRatio(evToEbit)} />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricCard label="Dividend Yield%" value={formatPercent(ratios?.dividendYield)} />
        <MetricCard label="ROE" value={formatPercent(metrics?.returnOnEquity)} />
        <MetricCard label="Revenue Growth (TTM)" value={formatPercent(revenueGrowth)} />
        <MetricCard label="EPS (Diluted)" value={formatCurrency(epsDiluted)} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Net Debt / EBITDA" value={formatRatio(metrics?.netDebtToEBITDA)} />
        <MetricCard label="FCF Conversion" value={formatPercent(fcfConversion)} />
        <MetricCard label="D/E" value={formatRatio(ratios?.debtToEquityRatio)} />
        <MetricCard label="Current Ratio" value={formatRatio(metrics?.currentRatio)} />
      </div>
    </div>
  );
}
