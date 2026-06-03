import { useMarket } from '@/contexts/MarketContext';
import { useGlobalTicker } from '@/hooks/useGlobalTicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export function MacroIndicators() {
  const { macroIndicators } = useMarket();
  const { data: tickerItems } = useGlobalTicker();

  const formatValue = (value: number, unit: string) => {
    if (unit === '%') return `${value.toFixed(2)}%`;
    return value.toFixed(2);
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return ArrowUp;
    if (change < 0) return ArrowDown;
    return Minus;
  };

  // Build commodity items from ticker data (same source as topbar)
  const commodityItems = (tickerItems || [])
    .filter((item) => item.symbol === 'GOLD' || item.symbol === 'OIL')
    .map((item) => ({
      name: item.symbol === 'GOLD' ? 'Gold' : 'WTI Crude Oil',
      value: item.value,
      previousValue: 0,
      change: item.change,
      unit: 'currency' as const,
      lastUpdated: '',
    }));

  return (
    <Card className="bg-sidebar-accent border-border h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-page-heading)' }}>Macro Indicators</CardTitle>
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

          {/* Commodities row - Gold & Oil from ticker API */}
          {commodityItems.map((item) => {
            const Icon = getChangeIcon(item.change);
            const isPositiveChange = item.change > 0;
            const isNegativeChange = item.change < 0;

            return (
              <div
                key={item.name}
                className="p-2.5 rounded-md bg-muted/50 border border-border/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                    {item.name}
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
                    ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {item.change !== 0 && (
                    <span
                      className={cn(
                        'text-xs font-mono',
                        isPositiveChange && 'text-positive',
                        isNegativeChange && 'text-negative'
                      )}
                    >
                      {item.change > 0 ? '+' : ''}
                      {item.change.toFixed(2)}
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
