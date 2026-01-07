import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, AlertTriangle, ShieldAlert, ShieldX } from 'lucide-react';
import type { MonteCarloResult } from '@/data/mockMonteCarlo';

interface MonteCarloStatsProps {
  result: MonteCarloResult;
  initialValue: number;
  targetReturn: number;
}

export function MonteCarloStats({ result, initialValue, targetReturn }: MonteCarloStatsProps) {
  const expectedReturn = ((result.expectedValue - initialValue) / initialValue) * 100;
  
  const primaryStats = [
    {
      label: 'Expected Value',
      value: `$${result.expectedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      subValue: `+${expectedReturn.toFixed(1)}% return`,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: `P(>${targetReturn}% Return)`,
      value: `${(result.probabilityOfTarget * 100).toFixed(1)}%`,
      subValue: `Target: +${targetReturn}%`,
      icon: Target,
      color: result.probabilityOfTarget > 0.5 ? 'text-emerald-500' : 'text-amber-500',
      bgColor: result.probabilityOfTarget > 0.5 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
    },
    {
      label: 'Probability of Loss',
      value: `${(result.probabilityOfLoss * 100).toFixed(1)}%`,
      subValue: 'Below initial value',
      icon: TrendingDown,
      color: result.probabilityOfLoss < 0.2 ? 'text-emerald-500' : 'text-red-500',
      bgColor: result.probabilityOfLoss < 0.2 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Outcome Volatility',
      value: `${result.volatilityOfOutcomes.toFixed(1)}%`,
      subValue: 'Std dev of final values',
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {primaryStats.map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-xl font-semibold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.subValue}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* VaR and CVaR metrics */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium">Risk Metrics</span>
            <Badge variant="outline" className="text-[10px] ml-auto">Value at Risk</Badge>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* VaR 95% */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">VaR (95%)</span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0">5% worst</Badge>
              </div>
              <p className="text-lg font-semibold text-red-500">
                -${result.var95.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                -{result.var95Pct.toFixed(1)}%
              </p>
            </div>

            {/* VaR 99% */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">VaR (99%)</span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0">1% worst</Badge>
              </div>
              <p className="text-lg font-semibold text-red-500">
                -${result.var99.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                -{result.var99Pct.toFixed(1)}%
              </p>
            </div>

            {/* CVaR 95% */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">CVaR (95%)</span>
                <Badge variant="destructive" className="text-[9px] px-1 py-0">Exp. Shortfall</Badge>
              </div>
              <p className="text-lg font-semibold text-red-600">
                -${result.cvar95.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                -{result.cvar95Pct.toFixed(1)}%
              </p>
            </div>

            {/* CVaR 99% */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">CVaR (99%)</span>
                <Badge variant="destructive" className="text-[9px] px-1 py-0">Exp. Shortfall</Badge>
              </div>
              <p className="text-lg font-semibold text-red-600">
                -${result.cvar99.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                -{result.cvar99Pct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>VaR:</strong> Maximum expected loss at confidence level. 
              <strong className="ml-2">CVaR:</strong> Average loss in worst-case scenarios beyond VaR threshold.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
