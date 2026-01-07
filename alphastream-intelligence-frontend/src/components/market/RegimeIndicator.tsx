import { useMarket } from '@/context/MarketContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Gauge } from 'lucide-react';

export function RegimeIndicator() {
  const { regime, regimeProbabilities, marketState } = useMarket();

  const getRegimeColor = () => {
    switch (regime) {
      case 'Risk-On':
        return 'text-positive border-positive/30 bg-positive/10';
      case 'Risk-Off':
        return 'text-negative border-negative/30 bg-negative/10';
      default:
        return 'text-warning border-warning/30 bg-warning/10';
    }
  };

  const getRegimeIcon = () => {
    switch (regime) {
      case 'Risk-On':
        return TrendingUp;
      case 'Risk-Off':
        return TrendingDown;
      default:
        return Gauge;
    }
  };

  const Icon = getRegimeIcon();

  return (
    <Card className={cn('border-2', getRegimeColor())}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <span className="font-semibold text-lg">{regime}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Market: {marketState.status}
          </span>
        </div>

        {/* Probability Bars */}
        <div className="space-y-2">
          <ProbabilityBar
            label="Risk-On"
            value={regimeProbabilities.riskOn}
            color="bg-positive"
          />
          <ProbabilityBar
            label="Neutral"
            value={regimeProbabilities.neutral}
            color="bg-warning"
          />
          <ProbabilityBar
            label="Risk-Off"
            value={regimeProbabilities.riskOff}
            color="bg-negative"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ProbabilityBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-xs font-mono w-10 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}
