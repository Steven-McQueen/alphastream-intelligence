import { PortfolioSummaryCards } from '@/components/portfolio/PortfolioSummaryCards';
import { AllocationChart } from '@/components/portfolio/AllocationChart';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioInsights } from '@/components/portfolio/PortfolioInsights';
import { PortfolioNewsSummary } from '@/components/portfolio/PortfolioNewsSummary';
import { PerformanceTable } from '@/components/portfolio/PerformanceTable';
import { usePortfolio } from '@/context/PortfolioContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, Link2, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

export default function Portfolio() {
  const { refreshPortfolio, isLoading, lastUpdated, holdings, portfolio } = usePortfolio();

  const handleExportCSV = () => {
    const headers = ['Ticker', 'Name', 'Shares', 'Price', 'Value', 'Weight', 'Cost Basis', 'Unrealized P&L', 'Strategy'];
    const rows = holdings.map((h) => [
      h.ticker,
      h.name,
      h.shares,
      h.currentPrice.toFixed(2),
      h.marketValue.toFixed(2),
      h.weight.toFixed(2),
      h.avgCostBasis.toFixed(2),
      h.unrealizedPnL.toFixed(2),
      h.strategy,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exported',
      description: `${holdings.length} holdings exported to CSV`,
    });
  };

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{portfolio.name}</h2>
            <Badge variant="outline" className="text-xs gap-1">
              <Link2 className="h-3 w-3" />
              Nordnet Connected
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={refreshPortfolio}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <PortfolioSummaryCards />

        {/* News Summary */}
        <PortfolioNewsSummary />

        {/* Holdings Table - Clickable */}
        <Link to="/holdings" className="block">
          <div className="bg-card border border-border rounded-lg overflow-hidden min-h-[300px] hover:border-primary/50 transition-colors cursor-pointer group">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium group-hover:text-primary transition-colors">Holdings</h3>
                <p className="text-xs text-muted-foreground">{holdings.length} positions</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="h-[250px] pointer-events-none">
              <HoldingsTable />
            </div>
          </div>
        </Link>

        {/* Portfolio Insights & Allocation Chart - Side by side */}
        <div className="flex gap-4">
          <div className="flex-1">
            <PortfolioInsights />
          </div>
          <div className="w-80">
            <AllocationChart />
          </div>
        </div>

        {/* Performance Table */}
        <PerformanceTable />
      </div>
    </div>
  );
}
