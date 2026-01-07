import { usePortfolio } from '@/context/PortfolioContext';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Generate mock performance data for different time periods
function generatePerformanceData(holdings: { ticker: string; name: string; unrealizedPnLPercent: number; dailyPnLPercent: number }[]) {
  return holdings.map((holding) => {
    // Generate realistic mock returns based on daily movement
    const daily = holding.dailyPnLPercent;
    const fiveDay = daily * (2 + Math.random() * 2) * (Math.random() > 0.3 ? 1 : -1);
    const oneMonth = fiveDay * (1.5 + Math.random() * 2);
    const sixMonth = oneMonth * (2 + Math.random() * 3);
    
    return {
      ticker: holding.ticker,
      name: holding.name,
      price: 0, // Will be filled from context
      return1D: holding.dailyPnLPercent,
      return5D: Math.round(fiveDay * 100) / 100,
      return1M: Math.round(oneMonth * 100) / 100,
      return6M: Math.round(sixMonth * 100) / 100,
      totalReturn: holding.unrealizedPnLPercent,
    };
  });
}

function formatReturn(value: number) {
  const formatted = `${value >= 0 ? '' : ''}${value.toFixed(2)}%`;
  return {
    text: formatted,
    className: value >= 0 ? 'text-green-400' : 'text-red-400',
  };
}

export function PerformanceTable() {
  const { holdings } = usePortfolio();
  
  const performanceData = generatePerformanceData(holdings).map((perf) => {
    const holding = holdings.find((h) => h.ticker === perf.ticker);
    return {
      ...perf,
      price: holding?.currentPrice || 0,
    };
  });

  // Sort by total return descending
  const sortedData = [...performanceData].sort((a, b) => b.totalReturn - a.totalReturn);

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">Performance Overview</h3>
        <p className="text-xs text-muted-foreground">{holdings.length} positions</p>
      </div>
      
      <div className="overflow-auto max-h-[400px]">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-[200px]">Stock</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">1D</TableHead>
              <TableHead className="text-right">5D</TableHead>
              <TableHead className="text-right">1M</TableHead>
              <TableHead className="text-right">6M</TableHead>
              <TableHead className="text-right">My Return</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => {
              const r1d = formatReturn(row.return1D);
              const r5d = formatReturn(row.return5D);
              const r1m = formatReturn(row.return1M);
              const r6m = formatReturn(row.return6M);
              const rTotal = formatReturn(row.totalReturn);

              return (
                <TableRow key={row.ticker} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                        {row.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.ticker}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    ${row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm ${r1d.className}`}>
                    {r1d.text}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm ${r5d.className}`}>
                    {r5d.text}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm ${r1m.className}`}>
                    {r1m.text}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm ${r6m.className}`}>
                    {r6m.text}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm font-semibold ${rTotal.className}`}>
                    {rTotal.text}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
