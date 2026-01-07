import { useMarket } from '@/context/MarketContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export function MacroIndicators() {
  const { macroIndicators } = useMarket();

  const formatValue = (value: number, unit: string) => {
    if (unit === '%') return `${value.toFixed(2)}%`;
    return value.toFixed(2);
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return ArrowUp;
    if (change < 0) return ArrowDown;
    return Minus;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Macro Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {macroIndicators.map((indicator) => {
            const Icon = getChangeIcon(indicator.change);
            const isPositiveChange = indicator.change > 0;
            const isNegativeChange = indicator.change < 0;

            return (
              <div
                key={indicator.name}
                className="p-2.5 rounded-md bg-muted/50 border border-border/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                    {indicator.name}
                  </span>
                  <Icon
                    className={cn(
                      'h-3 w-3',
                      isPositiveChange && 'text-positive',
                      isNegativeChange && 'text-negative',
                      !isPositiveChange && !isNegativeChange && 'text-muted-foreground'
                    )}
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-mono font-semibold">
                    {formatValue(indicator.value, indicator.unit)}
                  </span>
                  {indicator.change !== 0 && (
                    <span
                      className={cn(
                        'text-xs font-mono',
                        isPositiveChange && 'text-positive',
                        isNegativeChange && 'text-negative'
                      )}
                    >
                      {indicator.change > 0 ? '+' : ''}
                      {indicator.change.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
