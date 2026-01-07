import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { EfficientFrontierPoint } from '@/types';

interface PortfolioComparisonProps {
  current: EfficientFrontierPoint;
  optimal: EfficientFrontierPoint;
}

export function PortfolioComparison({ current, optimal }: PortfolioComparisonProps) {
  const metrics = [
    {
      label: 'Expected Return',
      current: current.expectedReturn,
      optimal: optimal.expectedReturn,
      format: (v: number) => `${v.toFixed(2)}%`,
      higherBetter: true,
    },
    {
      label: 'Volatility',
      current: current.volatility,
      optimal: optimal.volatility,
      format: (v: number) => `${v.toFixed(2)}%`,
      higherBetter: false,
    },
    {
      label: 'Sharpe Ratio',
      current: current.sharpeRatio,
      optimal: optimal.sharpeRatio,
      format: (v: number) => v.toFixed(3),
      higherBetter: true,
    },
  ];

  // Top weight changes
  const weightChanges = Object.keys(optimal.weights)
    .map((ticker) => ({
      ticker,
      current: current.weights[ticker] || 0,
      optimal: optimal.weights[ticker] || 0,
      change: (optimal.weights[ticker] || 0) - (current.weights[ticker] || 0),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Portfolio Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Metrics comparison */}
        <div className="space-y-4">
          {metrics.map((metric) => {
            const improvement = metric.higherBetter
              ? metric.optimal - metric.current
              : metric.current - metric.optimal;
            const isImproved = improvement > 0;
            
            return (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-amber-500">
                      {metric.format(metric.current)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-emerald-500">
                      {metric.format(metric.optimal)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(metric.current / (Math.max(metric.current, metric.optimal) * 1.2)) * 100}%` }}
                    />
                  </div>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(metric.optimal / (Math.max(metric.current, metric.optimal) * 1.2)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Weight changes */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm font-medium mb-3">Largest Weight Changes</p>
          <div className="space-y-3">
            {weightChanges.map(({ ticker, current, optimal, change }) => (
              <div key={ticker} className="flex items-center gap-3">
                <span className="w-12 text-sm font-medium">{ticker}</span>
                <div className="flex-1">
                  <Progress
                    value={optimal}
                    className="h-2"
                  />
                </div>
                <span
                  className={`text-sm font-mono w-16 text-right ${
                    change > 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
