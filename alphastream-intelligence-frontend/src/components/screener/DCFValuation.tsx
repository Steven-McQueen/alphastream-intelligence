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

const API_BASE_URL = "http://localhost:8000";

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
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        <span className="ml-3 text-zinc-400">Loading financial data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-zinc-500">
        <div className="text-center">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-lg font-medium mb-2">DCF Analysis Unavailable</p>
          <p className="text-sm text-zinc-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            DCF Valuation Model
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Discounted Cash Flow analysis for {data?.companyName || ticker}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={calculateDCF}
            disabled={calculating}
            className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", calculating && "animate-spin")} />
            Recalculate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={!result}
            className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Assumptions Header */}
            <button
              onClick={() => setShowAssumptions(!showAssumptions)}
              className="w-full flex items-center justify-between p-4 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-zinc-400" />
                <span className="font-semibold text-white">Assumptions</span>
              </div>
              {showAssumptions ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {showAssumptions && (
              <div className="p-4 space-y-4">
                {/* Projection Period */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Projection Years</label>
                  <Input
                    type="number"
                    value={inputs.projectionYears}
                    onChange={(e) => handleInputChange("projectionYears", e.target.value)}
                    className="h-9 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                {/* Growth & Margins */}
                <div className="border-t border-zinc-800 pt-4">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Growth & Margins
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">Revenue Growth (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.revenueGrowthRate}
                          onChange={(e) => handleInputChange("revenueGrowthRate", e.target.value)}
                          className="h-9 bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">EBIT Margin (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.ebitMargin}
                          onChange={(e) => handleInputChange("ebitMargin", e.target.value)}
                          className="h-9 bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">Tax Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.taxRate}
                          onChange={(e) => handleInputChange("taxRate", e.target.value)}
                          className="h-9 bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">Discount Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.discountRate}
                          onChange={(e) => handleInputChange("discountRate", e.target.value)}
                          className="h-9 bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CapEx & D&A */}
                <div className="border-t border-zinc-800 pt-4">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Capital Requirements
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">D&A Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.depreciationRate}
                          onChange={(e) => handleInputChange("depreciationRate", e.target.value)}
                          className="h-9 bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1">CapEx Rate (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={inputs.capexRate}
                          onChange={(e) => handleInputChange("capexRate", e.target.value)}
                          className="h-9 bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">NWC Rate (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={inputs.nwcRate}
                        onChange={(e) => handleInputChange("nwcRate", e.target.value)}
                        className="h-9 bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Terminal Value */}
                <div className="border-t border-zinc-800 pt-4">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Terminal Value
                  </h4>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setInputs((prev) => ({ ...prev, terminalMethod: "perpetual" }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-md transition-colors",
                        inputs.terminalMethod === "perpetual"
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      )}
                    >
                      Perpetual Growth
                    </button>
                    <button
                      onClick={() => setInputs((prev) => ({ ...prev, terminalMethod: "multiple" }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-md transition-colors",
                        inputs.terminalMethod === "multiple"
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      )}
                    >
                      Exit Multiple
                    </button>
                  </div>
                  {inputs.terminalMethod === "perpetual" ? (
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Perpetual Growth Rate (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={inputs.perpetualGrowthRate}
                        onChange={(e) => handleInputChange("perpetualGrowthRate", e.target.value)}
                        className="h-9 bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Exit EV/EBITDA Multiple</label>
                      <Input
                        type="number"
                        step="0.5"
                        value={inputs.exitMultiple}
                        onChange={(e) => handleInputChange("exitMultiple", e.target.value)}
                        className="h-9 bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Data Summary */}
            {data && (
              <div className="p-4 border-t border-zinc-800 bg-zinc-950/50">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Current Data
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Current Price</span>
                    <span className="text-white font-mono">${data.currentPrice?.toFixed(2) || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Shares Outstanding</span>
                    <span className="text-white font-mono">{formatNumber(data.sharesOutstanding / 1e6)}M</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Market Cap</span>
                    <span className="text-white font-mono">{formatCurrency(data.marketCap)}</span>
                  </div>
                  {data.historical[0] && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">LTM Revenue</span>
                        <span className="text-white font-mono">{formatCurrency(data.historical[0].revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Cash</span>
                        <span className="text-white font-mono">{formatCurrency(data.historical[0].totalCash)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Debt</span>
                        <span className="text-white font-mono">{formatCurrency(data.historical[0].totalDebt)}</span>
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Current Price</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  ${result.currentPrice?.toFixed(2)}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-2">
                  <Calculator className="w-4 h-4" />
                  <span>Intrinsic Value</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  ${result.intrinsicValuePerShare?.toFixed(2)}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-2">
                  {result.upside && result.upside > 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                  <span>Upside/Downside</span>
                </div>
                <div className={cn(
                  "text-2xl font-bold font-mono",
                  result.upside && result.upside > 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {formatPercent(result.upside)}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Enterprise Value</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatCurrency(result.enterpriseValue)}
                </div>
              </div>
            </div>
          )}

          {/* Charts Row */}
          {result && (
            <div className="grid grid-cols-2 gap-4">
              {/* Cash Flow Chart */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-4">Projected Cash Flows ($M)</h4>
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
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }}
                      labelStyle={{ color: "#a0a0a0" }}
                      formatter={(value: number) => [`$${value.toFixed(1)}M`]}
                    />
                    <Legend />
                    <Bar dataKey="ufcf" fill="#3b82f6" name="UFCF" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="pvUFCF" stroke="#10b981" name="PV UFCF" strokeWidth={2} dot={{ fill: "#10b981" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Valuation Comparison */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-4">Market vs Intrinsic Value</h4>
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
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }}
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
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h4 className="text-sm font-semibold text-white">Discounted Cash Flow Projections</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-700">
                      <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-400 uppercase">Year</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">Revenue</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">EBIT</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">- Taxes</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">+ D&A</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">- CapEx</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">- ΔNWC</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">UFCF</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase">PV Factor</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-emerald-400 uppercase">PV UFCF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.projections.map((p) => (
                      <tr key={p.year} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="py-3 px-4 text-zinc-300 font-medium">Year {p.year}</td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-300">{formatCurrency(p.revenue)}</td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-300">{formatCurrency(p.ebit)}</td>
                        <td className="py-3 px-4 text-right font-mono text-red-400">({formatCurrency(p.taxes)})</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">{formatCurrency(p.depreciation)}</td>
                        <td className="py-3 px-4 text-right font-mono text-red-400">({formatCurrency(p.capex)})</td>
                        <td className="py-3 px-4 text-right font-mono text-red-400">({formatCurrency(p.deltaNWC)})</td>
                        <td className="py-3 px-4 text-right font-mono text-white font-medium">{formatCurrency(p.ufcf)}</td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400">{p.discountFactor.toFixed(4)}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400 font-medium">{formatCurrency(p.pvUFCF)}</td>
                      </tr>
                    ))}
                    {/* Terminal Value Row */}
                    <tr className="bg-zinc-800/50 border-t border-zinc-700">
                      <td colSpan={7} className="py-3 px-4 text-zinc-300 font-medium">
                        Terminal Value ({result.terminalMethod === "perpetual" ? "Perpetual Growth" : "Exit Multiple"})
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white font-medium">{formatCurrency(result.terminalValue)}</td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400">-</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-medium">{formatCurrency(result.pvTerminalValue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Valuation Bridge */}
          {result && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white mb-4">Valuation Bridge</h4>
              <div className="grid grid-cols-6 gap-4 text-center">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Sum of PV FCF</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(result.sumPVCashFlows)}</div>
                </div>
                <div className="flex items-center justify-center text-zinc-500">+</div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">PV Terminal</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(result.pvTerminalValue)}</div>
                </div>
                <div className="flex items-center justify-center text-zinc-500">=</div>
                <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-lg p-3 col-span-2">
                  <div className="text-xs text-emerald-400 mb-1">Enterprise Value</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(result.enterpriseValue)}</div>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-4 text-center mt-4">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Enterprise Value</div>
                  <div className="text-lg font-bold text-white font-mono">{formatCurrency(result.enterpriseValue)}</div>
                </div>
                <div className="flex items-center justify-center text-emerald-400">+</div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Cash</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(result.cash)}</div>
                </div>
                <div className="flex items-center justify-center text-red-400">−</div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Debt</div>
                  <div className="text-lg font-bold text-red-400 font-mono">{formatCurrency(result.debt)}</div>
                </div>
                <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-lg p-3">
                  <div className="text-xs text-emerald-400 mb-1">Equity Value</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(result.equityValue)}</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-zinc-800">
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Equity Value</div>
                  <div className="text-xl font-bold text-white font-mono">{formatCurrency(result.equityValue)}</div>
                </div>
                <div className="text-2xl text-zinc-500">÷</div>
                <div className="text-center">
                  <div className="text-xs text-zinc-500 mb-1">Shares Outstanding</div>
                  <div className="text-xl font-bold text-white font-mono">{formatNumber(result.sharesOutstanding / 1e6)}M</div>
                </div>
                <div className="text-2xl text-zinc-500">=</div>
                <div className="text-center bg-emerald-600/20 border border-emerald-500/30 rounded-lg px-6 py-3">
                  <div className="text-xs text-emerald-400 mb-1">Intrinsic Value / Share</div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">${result.intrinsicValuePerShare.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs text-zinc-500">
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
