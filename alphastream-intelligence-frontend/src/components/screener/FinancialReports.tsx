import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown, ChevronUp, Loader2, TrendingUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL = "http://localhost:8000";

type Period = "annual" | "quarterly";
type ScaleUnit = "B" | "M" | "K";
type StatementType = "keyStats" | "income" | "balance" | "cashflow";

interface FinancialReportsProps {
  ticker: string;
}

interface FinancialData {
  income: any[];
  balance: any[];
  cashflow: any[];
  metrics: any[];
}

interface AnalystEstimate {
  date: string;
  symbol: string;
  estimatedRevenueLow: number;
  estimatedRevenueHigh: number;
  estimatedRevenueAvg: number;
  estimatedEbitdaLow: number;
  estimatedEbitdaHigh: number;
  estimatedEbitdaAvg: number;
  estimatedEbitLow: number;
  estimatedEbitHigh: number;
  estimatedEbitAvg: number;
  estimatedNetIncomeLow: number;
  estimatedNetIncomeHigh: number;
  estimatedNetIncomeAvg: number;
  estimatedSgaExpenseLow: number;
  estimatedSgaExpenseHigh: number;
  estimatedSgaExpenseAvg: number;
  estimatedEpsLow: number;
  estimatedEpsHigh: number;
  estimatedEpsAvg: number;
  numberAnalystEstimatedRevenue: number;
  numberAnalystsEstimatedEps: number;
}

// Format number based on scale
function formatValue(value: number | null | undefined, scale: ScaleUnit): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const divisor = scale === "B" ? 1e9 : scale === "M" ? 1e6 : 1e3;
  const formatted = (value / divisor).toFixed(2);
  return formatted === "-0.00" ? "0.00" : formatted;
}

// Format percentage
function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

// Format EPS
function formatEps(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `$${value.toFixed(2)}`;
}

// Get period label (Q1 2025 or FY 2025)
function getPeriodLabel(item: any): string {
  const year = item.fiscalYear || new Date(item.date).getFullYear();
  const period = item.period;
  if (period === "FY" || !period) return `FY ${year}`;
  return `${period} ${year}`;
}

// Row component for statements
function StatementRow({ 
  label, 
  values, 
  scale, 
  isHeader = false,
  indent = 0,
  isBold = false,
  formatFn,
  estimateIndices = []
}: { 
  label: string; 
  values: (number | null | undefined)[]; 
  scale: ScaleUnit;
  isHeader?: boolean;
  indent?: number;
  isBold?: boolean;
  formatFn?: (v: number | null | undefined) => string;
  estimateIndices?: number[]; // indices that are estimates
}) {
  const format = formatFn || ((v: number | null | undefined) => formatValue(v, scale));
  
  return (
    <tr className={cn(
      "border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors",
      isHeader && "bg-zinc-800/50",
      isBold && "font-semibold"
    )}>
      <td 
        className={cn(
          "py-2.5 px-4 text-sm text-zinc-300 sticky left-0 bg-zinc-900",
          isHeader && "bg-zinc-800/50 font-semibold text-white",
          isBold && "font-semibold text-white"
        )}
        style={{ paddingLeft: `${16 + indent * 16}px` }}
      >
        {label}
      </td>
      {values.map((v, i) => {
        const isEstimate = estimateIndices.includes(i);
        return (
          <td 
            key={i} 
            className={cn(
              "py-2.5 px-4 text-sm text-right font-mono",
              v && v < 0 ? "text-red-400" : "text-zinc-300",
              isHeader && "font-semibold text-white",
              isBold && "font-semibold text-white",
              isEstimate && "italic text-cyan-400/80" // Estimates in italics and different color
            )}
          >
            {format(v)}
          </td>
        );
      })}
    </tr>
  );
}

// Section header row
function SectionHeader({ label, colCount }: { label: string; colCount: number }) {
  return (
    <tr className="bg-zinc-800">
      <td 
        colSpan={colCount + 1} 
        className="py-3 px-4 text-xs font-bold text-zinc-400 uppercase tracking-wider"
      >
        {label}
      </td>
    </tr>
  );
}

export function FinancialReports({ ticker }: FinancialReportsProps) {
  const [period, setPeriod] = useState<Period>("annual");
  const [scale, setScale] = useState<ScaleUnit>("M");
  const [activeStatement, setActiveStatement] = useState<StatementType>("keyStats");
  const [data, setData] = useState<FinancialData | null>(null);
  const [estimates, setEstimates] = useState<AnalystEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["all"]));
  const [showEstimates, setShowEstimates] = useState(true);

  // Fetch financial data and estimates
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch financials and estimates in parallel
        const [financialsRes, estimatesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/stock/${ticker}/financials/all?period=${period}&limit=5`),
          fetch(`${API_BASE_URL}/api/stock/${ticker}/analyst/estimates?period=${period}&limit=4`)
        ]);
        
        if (!financialsRes.ok) throw new Error("Failed to fetch financial data");
        const financials = await financialsRes.json();
        setData(financials);
        
        // Estimates may fail for some stocks, that's ok
        if (estimatesRes.ok) {
          const estimatesData = await estimatesRes.json();
          // Filter to only future estimates (compare with start of current month to be more lenient)
          const now = new Date();
          const currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Give 1 month buffer
          
          // Sort by date descending and filter to future
          const futureEstimates = (estimatesData || [])
            .filter((est: AnalystEstimate) => {
              const estDate = new Date(est.date);
              return estDate >= currentPeriodStart;
            })
            .sort((a: AnalystEstimate, b: AnalystEstimate) => 
              new Date(a.date).getTime() - new Date(b.date).getTime()
            )
            .slice(0, 2); // Get next 2 periods
          
          setEstimates(futureEstimates);
        } else {
          setEstimates([]);
        }
      } catch (err) {
        console.error("Error fetching financials:", err);
        setError("Failed to load financial data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ticker, period]);

  // Generate CSV and trigger download
  const downloadExcel = () => {
    if (!data) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    const statements = { income: data.income, balance: data.balance, cashflow: data.cashflow };
    
    Object.entries(statements).forEach(([name, items]) => {
      if (!items || items.length === 0) return;
      csvContent += `\n${name.toUpperCase()} STATEMENT\n`;
      const headers = ["Metric", ...items.map(getPeriodLabel)];
      csvContent += headers.join(",") + "\n";
      
      // Add rows based on statement type
      Object.keys(items[0]).forEach(key => {
        if (["date", "symbol", "reportedCurrency", "cik", "filingDate", "acceptedDate", "fiscalYear", "period"].includes(key)) return;
        const values = items.map(item => item[key] ?? "");
        csvContent += `${key},${values.join(",")}\n`;
      });
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ticker}_financials_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        <p>{error || "No financial data available"}</p>
      </div>
    );
  }

  // Get period labels from actual data
  const historicalPeriods = data.income?.map(getPeriodLabel) || [];
  
  // Build estimate period labels
  const estimatePeriods = estimates.map(est => {
    const date = new Date(est.date);
    const year = date.getFullYear();
    if (period === "quarterly") {
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      return `Q${quarter} ${year} (Est.)`;
    }
    return `FY ${year} (Est.)`;
  });
  
  // Combine periods: estimates first (future), then historical
  const allPeriods = showEstimates && estimates.length > 0 
    ? [...estimatePeriods, ...historicalPeriods] 
    : historicalPeriods;
  const colCount = allPeriods.length;
  const estimateIndices = showEstimates ? estimates.map((_, i) => i) : [];

  // Helper to combine estimate values with historical values
  const combineWithEstimates = (
    historicalValues: (number | null | undefined)[],
    estimateField: keyof AnalystEstimate
  ): (number | null | undefined)[] => {
    if (!showEstimates || estimates.length === 0) return historicalValues;
    const estValues = estimates.map(est => est[estimateField] as number | null | undefined);
    return [...estValues, ...historicalValues];
  };

  // Render Income Statement
  const renderIncomeStatement = () => {
    const items = data.income;
    if (!items || items.length === 0) return <p className="text-zinc-500 p-4">No data available</p>;

    return (
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-zinc-900 border-b border-zinc-700">
            <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900">
              Metric
            </th>
            {allPeriods.map((p, i) => (
              <th 
                key={i} 
                className={cn(
                  "py-3 px-4 text-right text-xs font-semibold uppercase tracking-wider min-w-[100px]",
                  estimateIndices.includes(i) 
                    ? "text-cyan-400 bg-cyan-900/20" 
                    : "text-zinc-400"
                )}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="Revenue" colCount={colCount} />
          <StatementRow 
            label="Revenue" 
            values={combineWithEstimates(items.map(i => i.revenue), "estimatedRevenueAvg")} 
            scale={scale} 
            isBold 
            estimateIndices={estimateIndices}
          />
          <StatementRow label="Cost of Revenue" values={combineWithEstimates(items.map(i => i.costOfRevenue), "estimatedRevenueAvg")} scale={scale} indent={1} />
          <StatementRow label="Gross Profit" values={combineWithEstimates(items.map(i => i.grossProfit), "estimatedRevenueAvg")} scale={scale} isBold />
          
          <SectionHeader label="Operating Expenses" colCount={colCount} />
          <StatementRow label="R&D Expenses" values={combineWithEstimates(items.map(i => i.researchAndDevelopmentExpenses), "estimatedRevenueAvg")} scale={scale} indent={1} />
          <StatementRow 
            label="SG&A Expenses" 
            values={combineWithEstimates(items.map(i => i.sellingGeneralAndAdministrativeExpenses), "estimatedSgaExpenseAvg")} 
            scale={scale} 
            indent={1}
            estimateIndices={estimateIndices}
          />
          <StatementRow label="Total Operating Expenses" values={combineWithEstimates(items.map(i => i.operatingExpenses), "estimatedRevenueAvg")} scale={scale} />
          <StatementRow 
            label="Operating Income (EBIT)" 
            values={combineWithEstimates(items.map(i => i.operatingIncome), "estimatedEbitAvg")} 
            scale={scale} 
            isBold
            estimateIndices={estimateIndices}
          />
          
          <SectionHeader label="Other Income/Expenses" colCount={colCount} />
          <StatementRow label="Interest Income" values={combineWithEstimates(items.map(i => i.interestIncome), "estimatedRevenueAvg")} scale={scale} indent={1} />
          <StatementRow label="Interest Expense" values={combineWithEstimates(items.map(i => i.interestExpense), "estimatedRevenueAvg")} scale={scale} indent={1} />
          <StatementRow label="Other Income/Expense" values={combineWithEstimates(items.map(i => i.totalOtherIncomeExpensesNet), "estimatedRevenueAvg")} scale={scale} indent={1} />
          
          <SectionHeader label="Net Income" colCount={colCount} />
          <StatementRow label="Income Before Tax" values={combineWithEstimates(items.map(i => i.incomeBeforeTax), "estimatedNetIncomeAvg")} scale={scale} />
          <StatementRow label="Income Tax Expense" values={combineWithEstimates(items.map(i => i.incomeTaxExpense), "estimatedNetIncomeAvg")} scale={scale} indent={1} />
          <StatementRow 
            label="Net Income" 
            values={combineWithEstimates(items.map(i => i.netIncome), "estimatedNetIncomeAvg")} 
            scale={scale} 
            isBold
            estimateIndices={estimateIndices}
          />
          
          <SectionHeader label="Per Share Data" colCount={colCount} />
          <StatementRow label="EPS (Basic)" values={combineWithEstimates(items.map(i => i.eps), "estimatedEpsAvg")} scale={scale} formatFn={formatEps} estimateIndices={estimateIndices} />
          <StatementRow 
            label="EPS (Diluted)" 
            values={combineWithEstimates(items.map(i => i.epsDiluted), "estimatedEpsAvg")} 
            scale={scale} 
            formatFn={formatEps}
            estimateIndices={estimateIndices}
          />
          <StatementRow label="Shares Outstanding" values={combineWithEstimates(items.map(i => i.weightedAverageShsOut), "estimatedRevenueAvg")} scale={scale} />
          
          <SectionHeader label="EBITDA" colCount={colCount} />
          <StatementRow 
            label="EBITDA" 
            values={combineWithEstimates(items.map(i => i.ebitda), "estimatedEbitdaAvg")} 
            scale={scale} 
            isBold
            estimateIndices={estimateIndices}
          />
          <StatementRow label="D&A" values={combineWithEstimates(items.map(i => i.depreciationAndAmortization), "estimatedEbitdaAvg")} scale={scale} indent={1} />
        </tbody>
      </table>
    );
  };

  // Render Balance Sheet
  const renderBalanceSheet = () => {
    const items = data.balance;
    if (!items || items.length === 0) return <p className="text-zinc-500 p-4">No data available</p>;
    const periods = items.map(getPeriodLabel);

    return (
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-zinc-900 border-b border-zinc-700">
            <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900">
              Metric
            </th>
            {periods.map((p, i) => (
              <th key={i} className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider min-w-[100px]">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="Current Assets" colCount={colCount} />
          <StatementRow label="Cash & Cash Equivalents" values={items.map(i => i.cashAndCashEquivalents)} scale={scale} indent={1} />
          <StatementRow label="Short Term Investments" values={items.map(i => i.shortTermInvestments)} scale={scale} indent={1} />
          <StatementRow label="Net Receivables" values={items.map(i => i.netReceivables)} scale={scale} indent={1} />
          <StatementRow label="Inventory" values={items.map(i => i.inventory)} scale={scale} indent={1} />
          <StatementRow label="Other Current Assets" values={items.map(i => i.otherCurrentAssets)} scale={scale} indent={1} />
          <StatementRow label="Total Current Assets" values={items.map(i => i.totalCurrentAssets)} scale={scale} isBold />
          
          <SectionHeader label="Non-Current Assets" colCount={colCount} />
          <StatementRow label="Property, Plant & Equipment" values={items.map(i => i.propertyPlantEquipmentNet)} scale={scale} indent={1} />
          <StatementRow label="Goodwill" values={items.map(i => i.goodwill)} scale={scale} indent={1} />
          <StatementRow label="Intangible Assets" values={items.map(i => i.intangibleAssets)} scale={scale} indent={1} />
          <StatementRow label="Long Term Investments" values={items.map(i => i.longTermInvestments)} scale={scale} indent={1} />
          <StatementRow label="Other Non-Current Assets" values={items.map(i => i.otherNonCurrentAssets)} scale={scale} indent={1} />
          <StatementRow label="Total Non-Current Assets" values={items.map(i => i.totalNonCurrentAssets)} scale={scale} isBold />
          <StatementRow label="Total Assets" values={items.map(i => i.totalAssets)} scale={scale} isBold />
          
          <SectionHeader label="Current Liabilities" colCount={colCount} />
          <StatementRow label="Accounts Payable" values={items.map(i => i.accountPayables)} scale={scale} indent={1} />
          <StatementRow label="Short Term Debt" values={items.map(i => i.shortTermDebt)} scale={scale} indent={1} />
          <StatementRow label="Deferred Revenue" values={items.map(i => i.deferredRevenue)} scale={scale} indent={1} />
          <StatementRow label="Other Current Liabilities" values={items.map(i => i.otherCurrentLiabilities)} scale={scale} indent={1} />
          <StatementRow label="Total Current Liabilities" values={items.map(i => i.totalCurrentLiabilities)} scale={scale} isBold />
          
          <SectionHeader label="Non-Current Liabilities" colCount={colCount} />
          <StatementRow label="Long Term Debt" values={items.map(i => i.longTermDebt)} scale={scale} indent={1} />
          <StatementRow label="Deferred Tax Liabilities" values={items.map(i => i.deferredTaxLiabilitiesNonCurrent)} scale={scale} indent={1} />
          <StatementRow label="Other Non-Current Liabilities" values={items.map(i => i.otherNonCurrentLiabilities)} scale={scale} indent={1} />
          <StatementRow label="Total Non-Current Liabilities" values={items.map(i => i.totalNonCurrentLiabilities)} scale={scale} isBold />
          <StatementRow label="Total Liabilities" values={items.map(i => i.totalLiabilities)} scale={scale} isBold />
          
          <SectionHeader label="Shareholders' Equity" colCount={colCount} />
          <StatementRow label="Common Stock" values={items.map(i => i.commonStock)} scale={scale} indent={1} />
          <StatementRow label="Retained Earnings" values={items.map(i => i.retainedEarnings)} scale={scale} indent={1} />
          <StatementRow label="Accumulated Other Comprehensive Income" values={items.map(i => i.accumulatedOtherComprehensiveIncomeLoss)} scale={scale} indent={1} />
          <StatementRow label="Total Stockholders' Equity" values={items.map(i => i.totalStockholdersEquity)} scale={scale} isBold />
          <StatementRow label="Total Liabilities & Equity" values={items.map(i => i.totalLiabilitiesAndTotalEquity)} scale={scale} isBold />
        </tbody>
      </table>
    );
  };

  // Render Cash Flow Statement
  const renderCashFlow = () => {
    const items = data.cashflow;
    if (!items || items.length === 0) return <p className="text-zinc-500 p-4">No data available</p>;
    const periods = items.map(getPeriodLabel);

    return (
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-zinc-900 border-b border-zinc-700">
            <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900">
              Metric
            </th>
            {periods.map((p, i) => (
              <th key={i} className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider min-w-[100px]">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="Operating Activities" colCount={colCount} />
          <StatementRow label="Net Income" values={items.map(i => i.netIncome)} scale={scale} />
          <StatementRow label="Depreciation & Amortization" values={items.map(i => i.depreciationAndAmortization)} scale={scale} indent={1} />
          <StatementRow label="Stock-Based Compensation" values={items.map(i => i.stockBasedCompensation)} scale={scale} indent={1} />
          <StatementRow label="Change in Working Capital" values={items.map(i => i.changeInWorkingCapital)} scale={scale} indent={1} />
          <StatementRow label="Accounts Receivables" values={items.map(i => i.accountsReceivables)} scale={scale} indent={2} />
          <StatementRow label="Inventory" values={items.map(i => i.inventory)} scale={scale} indent={2} />
          <StatementRow label="Accounts Payables" values={items.map(i => i.accountsPayables)} scale={scale} indent={2} />
          <StatementRow label="Other Non-Cash Items" values={items.map(i => i.otherNonCashItems)} scale={scale} indent={1} />
          <StatementRow label="Cash from Operating Activities" values={items.map(i => i.netCashProvidedByOperatingActivities)} scale={scale} isBold />
          
          <SectionHeader label="Investing Activities" colCount={colCount} />
          <StatementRow label="Capital Expenditure" values={items.map(i => i.investmentsInPropertyPlantAndEquipment)} scale={scale} indent={1} />
          <StatementRow label="Acquisitions" values={items.map(i => i.acquisitionsNet)} scale={scale} indent={1} />
          <StatementRow label="Purchases of Investments" values={items.map(i => i.purchasesOfInvestments)} scale={scale} indent={1} />
          <StatementRow label="Sales of Investments" values={items.map(i => i.salesMaturitiesOfInvestments)} scale={scale} indent={1} />
          <StatementRow label="Cash from Investing Activities" values={items.map(i => i.netCashProvidedByInvestingActivities)} scale={scale} isBold />
          
          <SectionHeader label="Financing Activities" colCount={colCount} />
          <StatementRow label="Net Debt Issuance" values={items.map(i => i.netDebtIssuance)} scale={scale} indent={1} />
          <StatementRow label="Common Stock Repurchased" values={items.map(i => i.commonStockRepurchased)} scale={scale} indent={1} />
          <StatementRow label="Dividends Paid" values={items.map(i => i.commonDividendsPaid)} scale={scale} indent={1} />
          <StatementRow label="Other Financing Activities" values={items.map(i => i.otherFinancingActivities)} scale={scale} indent={1} />
          <StatementRow label="Cash from Financing Activities" values={items.map(i => i.netCashProvidedByFinancingActivities)} scale={scale} isBold />
          
          <SectionHeader label="Net Change in Cash" colCount={colCount} />
          <StatementRow label="Net Change in Cash" values={items.map(i => i.netChangeInCash)} scale={scale} isBold />
          <StatementRow label="Cash at Beginning of Period" values={items.map(i => i.cashAtBeginningOfPeriod)} scale={scale} indent={1} />
          <StatementRow label="Cash at End of Period" values={items.map(i => i.cashAtEndOfPeriod)} scale={scale} indent={1} />
          
          <SectionHeader label="Free Cash Flow" colCount={colCount} />
          <StatementRow label="Operating Cash Flow" values={items.map(i => i.operatingCashFlow)} scale={scale} />
          <StatementRow label="Capital Expenditure" values={items.map(i => i.capitalExpenditure)} scale={scale} />
          <StatementRow label="Free Cash Flow" values={items.map(i => i.freeCashFlow)} scale={scale} isBold />
        </tbody>
      </table>
    );
  };

  // Render Key Stats (calculated from other statements)
  const renderKeyStats = () => {
    const income = data.income;
    const balance = data.balance;
    const cashflow = data.cashflow;
    
    if (!income?.length || !balance?.length) {
      return <p className="text-zinc-500 p-4">No data available</p>;
    }

    const periods = income.map(getPeriodLabel);

    // Calculate key stats
    const calculateMargins = (inc: any) => ({
      grossMargin: inc.revenue ? inc.grossProfit / inc.revenue : null,
      operatingMargin: inc.revenue ? inc.operatingIncome / inc.revenue : null,
      netMargin: inc.revenue ? inc.netIncome / inc.revenue : null,
      ebitdaMargin: inc.revenue ? inc.ebitda / inc.revenue : null,
    });

    const calculateReturns = (inc: any, bal: any) => ({
      roe: bal.totalStockholdersEquity ? inc.netIncome / bal.totalStockholdersEquity : null,
      roa: bal.totalAssets ? inc.netIncome / bal.totalAssets : null,
      roic: (bal.totalStockholdersEquity && bal.totalDebt) 
        ? inc.operatingIncome * (1 - 0.21) / (bal.totalStockholdersEquity + bal.totalDebt) 
        : null,
    });

    const calculateLeverage = (bal: any) => ({
      debtToEquity: bal.totalStockholdersEquity ? bal.totalDebt / bal.totalStockholdersEquity : null,
      debtToAssets: bal.totalAssets ? bal.totalDebt / bal.totalAssets : null,
      currentRatio: bal.totalCurrentLiabilities ? bal.totalCurrentAssets / bal.totalCurrentLiabilities : null,
      quickRatio: bal.totalCurrentLiabilities 
        ? (bal.totalCurrentAssets - bal.inventory) / bal.totalCurrentLiabilities 
        : null,
    });

    return (
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-zinc-900 border-b border-zinc-700">
            <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900">
              Metric
            </th>
            {periods.map((p, i) => (
              <th key={i} className="py-3 px-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider min-w-[100px]">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="Profitability Margins" colCount={colCount} />
          <StatementRow 
            label="Gross Margin" 
            values={income.map(i => calculateMargins(i).grossMargin)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          <StatementRow 
            label="Operating Margin" 
            values={income.map(i => calculateMargins(i).operatingMargin)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          <StatementRow 
            label="Net Margin" 
            values={income.map(i => calculateMargins(i).netMargin)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          <StatementRow 
            label="EBITDA Margin" 
            values={income.map(i => calculateMargins(i).ebitdaMargin)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          
          <SectionHeader label="Returns" colCount={colCount} />
          <StatementRow 
            label="Return on Equity (ROE)" 
            values={income.map((inc, idx) => calculateReturns(inc, balance[idx] || {}).roe)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          <StatementRow 
            label="Return on Assets (ROA)" 
            values={income.map((inc, idx) => calculateReturns(inc, balance[idx] || {}).roa)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          <StatementRow 
            label="Return on Invested Capital (ROIC)" 
            values={income.map((inc, idx) => calculateReturns(inc, balance[idx] || {}).roic)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          
          <SectionHeader label="Leverage & Liquidity" colCount={colCount} />
          <StatementRow 
            label="Debt to Equity" 
            values={balance.map(b => calculateLeverage(b).debtToEquity)} 
            scale={scale} 
            formatFn={(v) => v !== null && v !== undefined ? v.toFixed(2) + "x" : "-"}
          />
          <StatementRow 
            label="Debt to Assets" 
            values={balance.map(b => calculateLeverage(b).debtToAssets)} 
            scale={scale} 
            formatFn={formatPercent}
          />
          <StatementRow 
            label="Current Ratio" 
            values={balance.map(b => calculateLeverage(b).currentRatio)} 
            scale={scale} 
            formatFn={(v) => v !== null && v !== undefined ? v.toFixed(2) + "x" : "-"}
          />
          <StatementRow 
            label="Quick Ratio" 
            values={balance.map(b => calculateLeverage(b).quickRatio)} 
            scale={scale} 
            formatFn={(v) => v !== null && v !== undefined ? v.toFixed(2) + "x" : "-"}
          />
          
          <SectionHeader label="Per Share Data" colCount={colCount} />
          <StatementRow label="EPS (Diluted)" values={income.map(i => i.epsDiluted)} scale={scale} formatFn={formatEps} />
          <StatementRow 
            label="Book Value per Share" 
            values={balance.map((b, idx) => {
              const shares = income[idx]?.weightedAverageShsOut;
              return shares ? b.totalStockholdersEquity / shares : null;
            })} 
            scale={scale} 
            formatFn={formatEps}
          />
          
          <SectionHeader label="Cash Flow" colCount={colCount} />
          <StatementRow label="Operating Cash Flow" values={cashflow?.map(c => c.operatingCashFlow) || []} scale={scale} />
          <StatementRow label="Free Cash Flow" values={cashflow?.map(c => c.freeCashFlow) || []} scale={scale} />
          <StatementRow 
            label="FCF Margin" 
            values={cashflow?.map((c, idx) => income[idx]?.revenue ? c.freeCashFlow / income[idx].revenue : null) || []} 
            scale={scale} 
            formatFn={formatPercent}
          />
        </tbody>
      </table>
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {/* Statement Type Tabs */}
          {(["keyStats", "income", "balance", "cashflow"] as StatementType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveStatement(type)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                activeStatement === type
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )}
            >
              {type === "keyStats" ? "Key Stats" : 
               type === "income" ? "Income Statement" : 
               type === "balance" ? "Balance Sheet" : 
               "Cash Flow"}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Estimates Toggle (only for income statement) */}
          {estimates.length > 0 && activeStatement === "income" && (
            <button
              onClick={() => setShowEstimates(!showEstimates)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border",
                showEstimates
                  ? "bg-cyan-600/20 text-cyan-400 border-cyan-500/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Estimates
            </button>
          )}

          {/* Period Toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setPeriod("annual")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                period === "annual" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Annual
            </button>
            <button
              onClick={() => setPeriod("quarterly")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                period === "quarterly" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Quarterly
            </button>
          </div>
          
          {/* Scale Toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1">
            {(["B", "M", "K"] as ScaleUnit[]).map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  scale === s ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          
          {/* Download Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={downloadExcel}
            className="border-zinc-700 hover:bg-zinc-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Estimates Legend */}
      {showEstimates && estimates.length > 0 && activeStatement === "income" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-cyan-900/10 border-b border-cyan-500/20">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs text-cyan-400">
            <span className="italic">Italicized values</span> are analyst estimates. 
            Based on {estimates[0]?.numberAnalystsEstimatedEps || 'N/A'} analyst{(estimates[0]?.numberAnalystsEstimatedEps || 0) !== 1 ? 's' : ''}.
          </span>
        </div>
      )}
      
      {/* Table Container - no max height, use page scroller */}
      <div className="overflow-x-auto">
        {activeStatement === "keyStats" && renderKeyStats()}
        {activeStatement === "income" && renderIncomeStatement()}
        {activeStatement === "balance" && renderBalanceSheet()}
        {activeStatement === "cashflow" && renderCashFlow()}
      </div>
    </div>
  );
}
