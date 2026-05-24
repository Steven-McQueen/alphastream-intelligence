import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Loader2, 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Percent,
  BarChart3,
  Settings2,
  Download,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Cell,
  ComposedChart,
  Area
} from "recharts";

import { API_BASE_URL } from "@/config/api";

interface DCFValuationProps {
  ticker: string;
}

interface HistoricalData {
  period: string;
  date: string;
  revenue: number;
  ebit: number;
  ebitda: number;
  netIncome: number;
  depreciationAndAmortization: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  operatingCashFlow: number;
  totalCash: number;
  totalDebt: number;
  netWorkingCapital: number;
  sharesOutstanding: number;
}

interface DCFData {
  symbol: string;
  companyName: string;
  currentPrice: number;
  marketCap: number;
  sharesOutstanding: number;
  beta: number;
  historical: HistoricalData[];
  defaults: {
    revenueGrowthRate: number;
    ebitMargin: number;
    taxRate: number;
    discountRate: number;
    perpetualGrowthRate: number;
    exitMultiple: number;
  };
}

interface Projection {
  year: number;
  revenue: number;
  ebit: number;
  taxes: number;
  nopat: number;
  depreciation: number;
  capex: number;
  deltaNWC: number;
  ufcf: number;
  discountFactor: number;
  pvUFCF: number;
}

interface DCFResult {
  symbol: string;
  projections: Projection[];
  terminalValue: number;
  pvTerminalValue: number;
  sumPVCashFlows: number;
  enterpriseValue: number;
  cash: number;
  debt: number;
  equityValue: number;
  sharesOutstanding: number;
  intrinsicValuePerShare: number;
  currentPrice: number;
  upside: number | null;
  terminalMethod: string;
  assumptions: Record<string, number | null>;
}

// Formatters
const formatNumber = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return value.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
};

export function DCFValuation({ ticker }: DCFValuationProps) {
  const [data, setData] = useState<DCFData | null>(null);
  const [result, setResult] = useState<DCFResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(true);

  // Input state
  const [inputs, setInputs] = useState({
    projectionYears: 5,
    revenueGrowthRate: 10,
    ebitMargin: 20,
    taxRate: 25,
    depreciationRate: 3,
    capexRate: 5,
    nwcRate: 10,
    discountRate: 10,
    terminalMethod: "perpetual" as "perpetual" | "multiple",
    perpetualGrowthRate: 2.5,
    exitMultiple: 10,
  });

  // Fetch DCF data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/dcf/data`);
        if (!res.ok) throw new Error("Failed to fetch DCF data");
        const dcfData: DCFData = await res.json();
        setData(dcfData);

        // Set defaults from API
        if (dcfData.defaults) {
          setInputs((prev) => ({
            ...prev,
            revenueGrowthRate: dcfData.defaults.revenueGrowthRate || prev.revenueGrowthRate,
            ebitMargin: dcfData.defaults.ebitMargin || prev.ebitMargin,
            taxRate: dcfData.defaults.taxRate || prev.taxRate,
            discountRate: dcfData.defaults.discountRate || prev.discountRate,
            perpetualGrowthRate: dcfData.defaults.perpetualGrowthRate || prev.perpetualGrowthRate,
            exitMultiple: dcfData.defaults.exitMultiple || prev.exitMultiple,
          }));
        }
      } catch (err) {
        console.error("Error fetching DCF data:", err);
        setError("Failed to load financial data for DCF analysis");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker]);

  // Calculate DCF when data is loaded or inputs change (with debounce)
  const calculateDCF = useCallback(async () => {
    if (!data) {
      console.warn("DCF: No data available");
      return;
    }
    if (!data.historical || data.historical.length === 0) {
      console.warn("DCF: No historical data available");
      return;
    }

    setCalculating(true);
    try {
      const latestHistorical = data.historical[0];
      
      // Validate required fields
      const baseRevenue = latestHistorical.revenue || 0;
      const sharesOutstanding = data.sharesOutstanding || latestHistorical.sharesOutstanding || 1;
      const cash = latestHistorical.totalCash || 0;
      const debt = latestHistorical.totalDebt || 0;
      const currentPrice = data.currentPrice || 0;
      
      if (baseRevenue === 0) {
        console.warn("DCF: Base revenue is 0, cannot calculate");
        return;
      }
      
      const payload = {
        ...inputs,
        sharesOutstanding,
        cash,
        debt,
        baseRevenue,
        currentPrice,
      };

      console.log("DCF: Sending calculation request", payload);
      
      const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/dcf/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("DCF calculation failed:", errorText);
        throw new Error("DCF calculation failed");
      }
      const dcfResult: DCFResult = await res.json();
      console.log("DCF: Calculation result received", dcfResult);
      setResult(dcfResult);
    } catch (err) {
      console.error("Error calculating DCF:", err);
    } finally {
      setCalculating(false);
    }
  }, [data, inputs, ticker]);

  // Auto-calculate on mount and input changes
  useEffect(() => {
    if (data) {
      const timer = setTimeout(calculateDCF, 500);
      return () => clearTimeout(timer);
    }
  }, [data, inputs, calculateDCF]);

  // Chart data
  const cashFlowChartData = useMemo(() => {
    if (!result?.projections) return [];
    return result.projections.map((p) => ({
      year: `Year ${p.year}`,
      ufcf: p.ufcf / 1e6,
      pvUFCF: p.pvUFCF / 1e6,
    }));
  }, [result]);

  const valuationChartData = useMemo(() => {
    if (!result) return [];
    return [
      { name: "Market Price", value: result.currentPrice, fill: "#3b82f6" },
      { name: "Intrinsic Value", value: result.intrinsicValuePerShare, fill: result.upside && result.upside > 0 ? "#10b981" : "#ef4444" },
    ];
  }, [result]);

  // Handle input change
  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setInputs((prev) => ({ ...prev, [field]: numValue }));
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!result) return;
    
    let csv = "DCF Valuation Analysis\n\n";
    csv += `Symbol,${result.symbol}\n`;
    csv += `Current Price,$${result.currentPrice}\n`;
    csv += `Intrinsic Value,$${result.intrinsicValuePerShare}\n`;
    csv += `Upside,${result.upside?.toFixed(2)}%\n\n`;
    
    csv += "Projected Cash Flows\n";
    csv += "Year,Revenue,EBIT,UFCF,PV UFCF\n";
    result.projections.forEach((p) => {
      csv += `${p.year},${p.revenue},${p.ebit},${p.ufcf},${p.pvUFCF}\n`;
    });
    
    csv += `\nTerminal Value,${result.terminalValue}\n`;
    csv += `PV Terminal Value,${result.pvTerminalValue}\n`;
    csv += `Enterprise Value,${result.enterpriseValue}\n`;
    csv += `Equity Value,${result.equityValue}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticker}_DCF_Analysis.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-dim" />
        <span className="ml-3 text-muted-foreground">Loading financial data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-dim">
        <div className="text-center">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-dim" />
          <p className="text-lg font-medium mb-2">DCF Analysis Unavailable</p>
          <p className="text-sm text-dim">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-5 h-5 text-positive" />
            DCF Valuation Model
          </h2>
          <p className="text-sm text-dim mt-1">
            Discounted Cash Flow analysis for {data?.companyName || ticker}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={calculateDCF}
            disabled={calculating}
            className="border-secondary bg-muted hover:bg-secondary"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", calculating && "animate-spin")} />
            Recalculate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={!result}
            className="border-secondary bg-muted hover:bg-secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Assumptions Panel */}
        <div className="col-span-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Assumptions Header */}
            <button
              onClick={() => setShowAssumptions(!showAssumptions)}
              className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">Assumptions</span>
              </div>
              {showAssumptions ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showAssumptions && (
              <div className="p-4 space-y-4">
                {/* Projection Period */}
                <div>
                  <label className="block text-xs text-dim mb-1">Projection Years</label>
                  <Input
                    type="number"
                    value={inputs.projectionYears}
                    onChange={(e) => handleInputChange("projectionYears", e.target.value)}
                    className="h-9 bg-muted border-secondary text-foreground"
                  />
                </div>

                {/* Growth & Margins */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Growth & Margins
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-dim mb-1">Revenue Growth (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.revenueGrowthRate}
                          onChange={(e) => handleInputChange("revenueGrowthRate", e.target.value)}
                          className="h-9 bg-muted border-secondary text-foreground"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-dim mb-1">EBIT Margin (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.ebitMargin}
                          onChange={(e) => handleInputChange("ebitMargin", e.target.value)}
                          className="h-9 bg-muted border-secondary text-foreground"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-dim mb-1">Tax Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.taxRate}
                          onChange={(e) => handleInputChange("taxRate", e.target.value)}
                          className="h-9 bg-muted border-secondary text-foreground"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-dim mb-1">Discount Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.discountRate}
                          onChange={(e) => handleInputChange("discountRate", e.target.value)}
                          className="h-9 bg-muted border-secondary text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CapEx & D&A */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Capital Requirements
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-dim mb-1">D&A Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.depreciationRate}
                          onChange={(e) => handleInputChange("depreciationRate", e.target.value)}
                          className="h-9 bg-muted border-secondary text-foreground"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-dim mb-1">CapEx Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.capexRate}
                          onChange={(e) => handleInputChange("capexRate", e.target.value)}
                          className="h-9 bg-muted border-secondary text-foreground"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-dim mb-1">NWC Rate (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={inputs.nwcRate}
                        onChange={(e) => handleInputChange("nwcRate", e.target.value)}
                        className="h-9 bg-muted border-secondary text-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Terminal Value */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Terminal Value
                  </h4>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setInputs((prev) => ({ ...prev, terminalMethod: "perpetual" }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-md transition-colors",
                        inputs.terminalMethod === "perpetual"
                          ? "bg-positive/20 text-positive border border-positive/30"
                          : "bg-muted text-muted-foreground border border-secondary"
                      )}
                    >
                      Perpetual Growth
                    </button>
                    <button
                      onClick={() => setInputs((prev) => ({ ...prev, terminalMethod: "multiple" }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-md transition-colors",
                        inputs.terminalMethod === "multiple"
                          ? "bg-positive/20 text-positive border border-positive/30"
                          : "bg-muted text-muted-foreground border border-secondary"
                      )}
                    >
                      Exit Multiple
                    </button>
                  </div>
                  {inputs.terminalMethod === "perpetual" ? (
                    <div>
                      <label className="block text-xs text-dim mb-1">Perpetual Growth Rate (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={inputs.perpetualGrowthRate}
                        onChange={(e) => handleInputChange("perpetualGrowthRate", e.target.value)}
                        className="h-9 bg-muted border-secondary text-foreground"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-dim mb-1">Exit EV/EBITDA Multiple</label>
                      <Input
                        type="number"
                        step="0.5"
                        value={inputs.exitMultiple}
                        onChange={(e) => handleInputChange("exitMultiple", e.target.value)}
                        className="h-9 bg-muted border-secondary text-foreground"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Data Summary */}
            {data && (
              <div className="p-4 border-t border-border bg-background/50">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Current Data
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dim">Current Price</span>
                    <span className="text-foreground font-mono">${data.currentPrice?.toFixed(2) || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dim">Shares Outstanding</span>
                    <span className="text-foreground font-mono">{formatNumber(data.sharesOutstanding / 1e6)}M</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dim">Market Cap</span>
                    <span className="text-foreground font-mono">{formatCurrency(data.marketCap)}</span>
                  </div>
                  {data.historical[0] && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-dim">LTM Revenue</span>
                        <span className="text-foreground font-mono">{formatCurrency(data.historical[0].revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dim">Cash</span>
                        <span className="text-foreground font-mono">{formatCurrency(data.historical[0].totalCash)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dim">Debt</span>
                        <span className="text-foreground font-mono">{formatCurrency(data.historical[0].totalDebt)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="col-span-8 space-y-6">
          {/* Valuation Summary Cards */}
          {result && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-dim text-xs mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Current Price</span>
                </div>
                <div className="text-2xl font-bold text-foreground font-mono">
                  ${result.currentPrice?.toFixed(2)}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-dim text-xs mb-2">
                  <Calculator className="w-4 h-4" />
                  <span>Intrinsic Value</span>
                </div>
                <div className="text-2xl font-bold text-positive font-mono">
                  ${result.intrinsicValuePerShare?.toFixed(2)}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-dim text-xs mb-2">
                  {result.upside && result.upside > 0 ? (
                    <TrendingUp className="w-4 h-4 text-positive" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-negative" />
                  )}
                  <span>Upside/Downside</span>
                </div>
                <div className={cn(
                  "text-2xl font-bold font-mono",
                  result.upside && result.upside > 0 ? "text-positive" : "text-negative"
                )}>
                  {formatPercent(result.upside)}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-dim text-xs mb-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Enterprise Value</span>
                </div>
                <div className="text-2xl font-bold text-foreground font-mono">
                  {formatCurrency(result.enterpriseValue)}
                </div>
              </div>
            </div>
          )}

          {/* Charts Row */}
          {result && (
            <div className="grid grid-cols-2 gap-4">
              {/* Cash Flow Chart */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground mb-4">Projected Cash Flows ($M)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={cashFlowChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="year" 
                      stroke="#52525b" 
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={{ stroke: "#27272a" }}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={{ stroke: "#27272a" }}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--tooltip-bg))", border: "1px solid hsl(var(--tooltip-border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--tooltip-label))" }}
                      formatter={(value: number) => [`$${value.toFixed(1)}M`]}
                    />
                    <Legend />
                    <Bar dataKey="ufcf" fill="#3b82f6" name="UFCF" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="pvUFCF" stroke="#10b981" name="PV UFCF" strokeWidth={2} dot={{ fill: "#10b981" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Valuation Comparison */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground mb-4">Market vs Intrinsic Value</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={valuationChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis 
                      type="number" 
                      stroke="#52525b" 
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="#52525b" 
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--tooltip-bg))", border: "1px solid hsl(var(--tooltip-border))", borderRadius: "8px" }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {valuationChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Projections Table */}
          {result && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">Discounted Cash Flow Projections</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-secondary">
                      <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase">Year</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">EBIT</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">- Taxes</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">+ D&A</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">- CapEx</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">- ΔNWC</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">UFCF</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase">PV Factor</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-positive uppercase">PV UFCF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.projections.map((p) => (
                      <tr key={p.year} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4 text-soft font-medium">Year {p.year}</td>
                        <td className="py-3 px-4 text-right font-mono text-soft">{formatCurrency(p.revenue)}</td>
                        <td className="py-3 px-4 text-right font-mono text-soft">{formatCurrency(p.ebit)}</td>
                        <td className="py-3 px-4 text-right font-mono text-negative">({formatCurrency(p.taxes)})</td>
                        <td className="py-3 px-4 text-right font-mono text-positive">{formatCurrency(p.depreciation)}</td>
                        <td className="py-3 px-4 text-right font-mono text-negative">({formatCurrency(p.capex)})</td>
                        <td className="py-3 px-4 text-right font-mono text-negative">({formatCurrency(p.deltaNWC)})</td>
                        <td className="py-3 px-4 text-right font-mono text-foreground font-medium">{formatCurrency(p.ufcf)}</td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">{p.discountFactor.toFixed(4)}</td>
                        <td className="py-3 px-4 text-right font-mono text-positive font-medium">{formatCurrency(p.pvUFCF)}</td>
                      </tr>
                    ))}
                    {/* Terminal Value Row */}
                    <tr className="bg-muted/50 border-t border-secondary">
                      <td colSpan={7} className="py-3 px-4 text-soft font-medium">
                        Terminal Value ({result.terminalMethod === "perpetual" ? "Perpetual Growth" : "Exit Multiple"})
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground font-medium">{formatCurrency(result.terminalValue)}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">-</td>
                      <td className="py-3 px-4 text-right font-mono text-positive font-medium">{formatCurrency(result.pvTerminalValue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Valuation Bridge */}
          {result && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-4">Valuation Bridge</h4>
              <div className="grid grid-cols-6 gap-4 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-dim mb-1">Sum of PV FCF</div>
                  <div className="text-lg font-bold text-foreground font-mono">{formatCurrency(result.sumPVCashFlows)}</div>
                </div>
                <div className="flex items-center justify-center text-dim">+</div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-dim mb-1">PV Terminal</div>
                  <div className="text-lg font-bold text-foreground font-mono">{formatCurrency(result.pvTerminalValue)}</div>
                </div>
                <div className="flex items-center justify-center text-dim">=</div>
                <div className="bg-positive/20 border border-positive/30 rounded-lg p-3 col-span-2">
                  <div className="text-xs text-positive mb-1">Enterprise Value</div>
                  <div className="text-lg font-bold text-positive font-mono">{formatCurrency(result.enterpriseValue)}</div>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-4 text-center mt-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-dim mb-1">Enterprise Value</div>
                  <div className="text-lg font-bold text-foreground font-mono">{formatCurrency(result.enterpriseValue)}</div>
                </div>
                <div className="flex items-center justify-center text-positive">+</div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-dim mb-1">Cash</div>
                  <div className="text-lg font-bold text-positive font-mono">{formatCurrency(result.cash)}</div>
                </div>
                <div className="flex items-center justify-center text-negative">−</div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-dim mb-1">Debt</div>
                  <div className="text-lg font-bold text-negative font-mono">{formatCurrency(result.debt)}</div>
                </div>
                <div className="bg-positive/20 border border-positive/30 rounded-lg p-3">
                  <div className="text-xs text-positive mb-1">Equity Value</div>
                  <div className="text-lg font-bold text-positive font-mono">{formatCurrency(result.equityValue)}</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="text-xs text-dim mb-1">Equity Value</div>
                  <div className="text-xl font-bold text-foreground font-mono">{formatCurrency(result.equityValue)}</div>
                </div>
                <div className="text-2xl text-dim">÷</div>
                <div className="text-center">
                  <div className="text-xs text-dim mb-1">Shares Outstanding</div>
                  <div className="text-xl font-bold text-foreground font-mono">{formatNumber(result.sharesOutstanding / 1e6)}M</div>
                </div>
                <div className="text-2xl text-dim">=</div>
                <div className="text-center bg-positive/20 border border-positive/30 rounded-lg px-6 py-3">
                  <div className="text-xs text-positive mb-1">Intrinsic Value / Share</div>
                  <div className="text-2xl font-bold text-positive font-mono">${result.intrinsicValuePerShare.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-4 bg-card/50 border border-border rounded-xl text-xs text-dim">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              This DCF model is for educational and informational purposes only. The intrinsic value calculation 
              is based on assumptions that may not reflect future performance. Always conduct your own due diligence 
              before making investment decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
