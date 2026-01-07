import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertTriangle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  type: 'opportunity' | 'warning' | 'info';
  title: string;
  description: string;
  ticker?: string;
}

export function PortfolioInsights() {
  const { holdings, sectorAllocation, factorExposures } = usePortfolio();

  // Generate mock AI insights based on portfolio data
  const insights: Insight[] = [];

  // Check for concentration
  const topHolding = [...holdings].sort((a, b) => b.weight - a.weight)[0];
  if (topHolding && topHolding.weight > 12) {
    insights.push({
      type: 'warning',
      title: 'Concentration Risk',
      description: `${topHolding.ticker} represents ${topHolding.weight.toFixed(1)}% of portfolio. Consider rebalancing.`,
      ticker: topHolding.ticker,
    });
  }

  // Check sector exposure
  const techAllocation = sectorAllocation['Technology'];
  if (techAllocation && techAllocation.weight > 35) {
    insights.push({
      type: 'warning',
      title: 'Sector Overweight',
      description: `Technology at ${techAllocation.weight.toFixed(1)}% is above typical thresholds. Diversify across sectors.`,
    });
  }

  // Factor insight
  const momentumFactor = factorExposures.find((f) => f.factor === 'Momentum');
  if (momentumFactor && momentumFactor.exposure > 0.5) {
    insights.push({
      type: 'info',
      title: 'Strong Momentum Tilt',
      description: `Portfolio has significant momentum exposure (${momentumFactor.exposure.toFixed(2)}). Consider market timing.`,
    });
  }

  // Top performer insight
  const topGainer = [...holdings].sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent)[0];
  if (topGainer && topGainer.unrealizedPnLPercent > 50) {
    insights.push({
      type: 'opportunity',
      title: 'Tax Loss Harvesting',
      description: `${topGainer.ticker} up ${topGainer.unrealizedPnLPercent.toFixed(0)}%. Consider taking profits for rebalancing.`,
      ticker: topGainer.ticker,
    });
  }

  // Add a general insight if few others
  if (insights.length < 3) {
    insights.push({
      type: 'opportunity',
      title: 'Quality Focus',
      description: 'Portfolio maintains quality-growth orientation. Consider adding defensive positions.',
    });
  }

  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity':
        return TrendingUp;
      case 'warning':
        return AlertTriangle;
      default:
        return Lightbulb;
    }
  };

  const getStyles = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity':
        return 'border-positive/30 bg-positive/5';
      case 'warning':
        return 'border-warning/30 bg-warning/5';
      default:
        return 'border-primary/30 bg-primary/5';
    }
  };

  const getIconStyles = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity':
        return 'text-positive';
      case 'warning':
        return 'text-warning';
      default:
        return 'text-primary';
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Portfolio Insights
          <Badge variant="secondary" className="ml-auto text-[10px]">
            AI-Powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {insights.slice(0, 4).map((insight, index) => {
            const Icon = getIcon(insight.type);
            return (
              <div
                key={index}
                className={cn(
                  'p-3 rounded-md border',
                  getStyles(insight.type)
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', getIconStyles(insight.type))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{insight.title}</span>
                      {insight.ticker && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
                          {insight.ticker}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-muted-foreground text-center pt-3">
          Insights generated from portfolio analysis
        </div>
      </CardContent>
    </Card>
  );
}
