import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '@/context/MarketContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getIndexIntradayData } from '@/data/mockMarket';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

function IndexCard({ symbol, name, value, change, changePercent, onClick }: {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  onClick: () => void;
}) {
  const intradayData = useMemo(() => getIndexIntradayData(symbol), [symbol]);
  const isPositive = changePercent >= 0;
  
  return (
    <Card 
      className="p-4 bg-card border-border overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-base text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">{symbol}</div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              'text-xs font-mono px-2 py-1 rounded',
              isPositive ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'
            )}
          >
            {isPositive ? '↗' : '↘'} {Math.abs(changePercent).toFixed(2)}%
          </div>
          <div
            className={cn(
              'text-xs font-mono mt-1',
              isPositive ? 'text-positive' : 'text-negative'
            )}
          >
            {change >= 0 ? '+' : ''}{change.toFixed(2)}
          </div>
        </div>
      </div>
      
      {/* Sparkline Chart */}
      <div className="h-16 -mx-2 my-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={intradayData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
              strokeWidth={2}
              fill={`url(#gradient-${symbol})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Current Value */}
      <div className="font-mono text-2xl font-semibold text-foreground">
        {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </Card>
  );
}

export function IndicesOverview() {
  const { indices } = useMarket();
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {indices.map((index) => (
        <IndexCard
          key={index.symbol}
          symbol={index.symbol}
          name={index.name}
          value={index.value}
          change={index.change}
          changePercent={index.changePercent}
          onClick={() => navigate(`/market/${index.symbol}`)}
        />
      ))}
    </div>
  );
}
