import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Percent } from 'lucide-react';

export function PortfolioSummaryCards() {
  const { summary, portfolio } = usePortfolio();

  const cards = [
    {
      label: 'Total Value',
      value: `$${summary.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      subValue: `$${summary.cash.toLocaleString()} cash`,
      icon: DollarSign,
      trend: null,
    },
    {
      label: 'YTD Return',
      value: `${summary.ytdReturn >= 0 ? '+' : ''}${summary.ytdReturn.toFixed(2)}%`,
      subValue: `$${portfolio.totalUnrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })} unrealized`,
      icon: TrendingUp,
      trend: summary.ytdReturn >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Daily P&L',
      value: `${summary.dailyPnL >= 0 ? '+' : ''}$${Math.abs(summary.dailyPnL).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      subValue: `${summary.dailyPnLPercent >= 0 ? '+' : ''}${summary.dailyPnLPercent.toFixed(2)}%`,
      icon: summary.dailyPnL >= 0 ? TrendingUp : TrendingDown,
      trend: summary.dailyPnL >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Volatility',
      value: `${summary.volatility.toFixed(1)}%`,
      subValue: `Sharpe: ${summary.sharpeRatio.toFixed(2)}`,
      icon: Activity,
      trend: null,
    },
    {
      label: 'Beta',
      value: portfolio.beta.toFixed(2),
      subValue: 'vs S&P 500',
      icon: BarChart3,
      trend: null,
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {card.label}
              </span>
              <card.icon
                className={cn(
                  'h-4 w-4',
                  card.trend === 'positive' && 'text-positive',
                  card.trend === 'negative' && 'text-negative',
                  !card.trend && 'text-muted-foreground'
                )}
              />
            </div>
            <div
              className={cn(
                'text-xl font-semibold font-mono',
                card.trend === 'positive' && 'text-positive',
                card.trend === 'negative' && 'text-negative'
              )}
            >
              {card.value}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.subValue}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
