import { Stock } from "@/types";
import React from "react";

interface MetricRowProps {
  label: string;
  value: string | number | React.ReactNode;
  format?: "percent" | "currency" | "number" | "integer";
  className?: string;
}

function MetricRow({ label, value, format, className = "" }: MetricRowProps) {
  let displayValue: React.ReactNode = value;

  if (typeof value === "number") {
    if (format === "percent") {
      const numValue = value as number;
      const colorClass = numValue >= 0 ? "text-green-500" : "text-red-500";
      displayValue = (
        <span className={colorClass}>
          {numValue >= 0 ? "+" : ""}
          {numValue.toFixed(2)}%
        </span>
      );
    } else if (format === "currency") {
      displayValue = `$${value.toFixed(2)}`;
    } else if (format === "integer") {
      displayValue = Math.round(value).toString();
    } else {
      displayValue = value.toFixed(2);
    }
  } else if (value === null || value === undefined) {
    displayValue = <span className="text-zinc-500">N/A</span>;
  }

  return (
    <div className={`flex justify-between items-center py-2 ${className}`}>
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-white">{displayValue}</span>
    </div>
  );
}

interface StockOverviewMetricsProps {
  stock: Stock;
}

export function StockOverviewMetrics({ stock }: StockOverviewMetricsProps) {
  return (
    <div className="space-y-6 p-4">
      <section>
        <h3 className="text-sm font-semibold text-white mb-3 border-b border-zinc-800 pb-2">
          Performance
        </h3>
        <div className="space-y-1">
          <MetricRow label="1D" value={stock.change1D ?? "N/A"} format="percent" />
          <MetricRow label="1W" value={stock.change1W ?? "N/A"} format="percent" />
          <MetricRow label="1M" value={stock.change1M ?? "N/A"} format="percent" />
          <MetricRow label="1Y" value={stock.change1Y ?? "N/A"} format="percent" />
          <MetricRow label="5Y" value={stock.change5Y ?? "N/A"} format="percent" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white mb-3 border-b border-zinc-800 pb-2">
          Valuation
        </h3>
        <div className="space-y-1">
          <MetricRow label="P/E Ratio" value={stock.peRatio ?? "N/A"} format="number" />
          <MetricRow label="EPS" value={stock.eps ?? "N/A"} format="currency" />
          <MetricRow
            label="Dividend Yield"
            value={stock.dividendYield ?? "N/A"}
            format="percent"
          />
          <MetricRow
            label="Market Cap"
            value={
              stock.marketCap ? `$${(stock.marketCap / 1000).toFixed(2)}B` : "N/A"
            }
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white mb-3 border-b border-zinc-800 pb-2">
          Profitability
        </h3>
        <div className="space-y-1">
          <MetricRow label="Gross Margin" value={stock.grossMargin ?? "N/A"} format="percent" />
          <MetricRow label="Net Margin" value={stock.netProfitMargin ?? "N/A"} format="percent" />
          <MetricRow label="ROE" value={stock.roe ?? "N/A"} format="percent" />
          <MetricRow
            label="Revenue (TTM)"
            value={stock.revenue ? `$${(stock.revenue / 1000).toFixed(2)}B` : "N/A"}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white mb-3 border-b border-zinc-800 pb-2">
          Ownership & Risk
        </h3>
        <div className="space-y-1">
          <MetricRow
            label="Institutional"
            value={stock.institutionalOwnership ?? "N/A"}
            format="percent"
          />
          <MetricRow label="Beta" value={stock.beta ?? "N/A"} format="number" />
          <MetricRow
            label="Shares Out"
            value={
              stock.sharesOutstanding ? `${stock.sharesOutstanding.toFixed(0)}M` : "N/A"
            }
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white mb-3 border-b border-zinc-800 pb-2">
          Company Info
        </h3>
        <div className="space-y-1">
          <MetricRow
            label="Founded"
            value={
              stock.yearFounded !== undefined && stock.yearFounded !== null
                ? stock.yearFounded
                : "N/A"
            }
            format="integer"
          />
          <MetricRow
            label="Headquarters"
            value={
              stock.city && stock.state ? `${stock.city}, ${stock.state}` : "N/A"
            }
          />
          {stock.website && (
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-zinc-400">Website</span>
              <a
                href={stock.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {stock.website.replace("https://", "").replace("http://", "")}
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

