import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIndexTiles, getMacroTiles } from '@/data/mockFinanceHome';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export function IndicesMacroCard() {
  const indices = getIndexTiles();
  const macros = getMacroTiles();

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Indices & Macro</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Index Tiles */}
        <div className="grid grid-cols-2 gap-3">
          {indices.map((index) => (
            <div
              key={index.symbol}
              className="bg-muted/30 rounded-lg p-3 border border-border/50 hover:border-border transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{index.symbol}</span>
                {index.changePercent >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-positive" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-negative" />
                )}
              </div>
              <div className="text-base font-mono font-semibold mb-1">
                {index.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-xs font-mono',
                  index.changePercent >= 0 ? 'text-positive' : 'text-negative'
                )}>
                  {index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                </span>
                {/* Mini Sparkline */}
                <div className="w-12 h-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={index.sparkline.map((v, i) => ({ i, v }))}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={index.changePercent >= 0 ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                        strokeWidth={1}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Macro Tiles */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">Macro Indicators</div>
          <div className="grid grid-cols-2 gap-2">
            {macros.slice(0, 4).map((macro) => (
              <div
                key={macro.name}
                className="flex items-center justify-between py-1.5 px-2 bg-muted/20 rounded text-xs"
              >
                <span className="text-muted-foreground truncate">{macro.name.replace('US ', '')}</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span>{macro.value.toFixed(2)}{macro.unit}</span>
                  <span className={cn(
                    macro.change >= 0 ? 'text-positive' : 'text-negative'
                  )}>
                    {macro.change >= 0 ? '+' : ''}{macro.change.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
