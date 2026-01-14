import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '@/context/MarketContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { useIndicesIntraday } from '@/hooks/useIndicesIntraday';

type FlashDir = 'up' | 'down' | null;

function IndexCard({ symbol, name, value, change, changePercent, flashDir, series, onClick }: {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  flashDir: FlashDir;
  series: { date: string; value: number }[];
  onClick: () => void;
}) {
  const intradayData = useMemo(() => series || [], [series]);
  const isPositive = changePercent >= 0;
  const flashClass =
    flashDir === 'up'
      ? 'bg-emerald-500/10'
      : flashDir === 'down'
        ? 'bg-red-500/10'
        : '';
  
  return (
    <Card 
      className={cn(
        "p-4 bg-card border-border overflow-hidden cursor-pointer hover:bg-muted/50 transition-all",
        flashClass
      )}
      style={{
        transform: flashDir ? 'scale(1.015)' : 'scale(1)',
        transition: 'transform 0.25s ease, background-color 0.3s ease',
      }}
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
        {intradayData.length > 0 ? (() => {
          // Calculate min/max for zoomed Y-axis
          const values = intradayData.map(d => d.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min;
          const padding = range > 0 ? range * 0.1 : max * 0.001;
          const yMin = min - padding;
          const yMax = max + padding;

          return (
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
                <YAxis domain={[yMin, yMax]} hide />
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
          );
        })() : (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
            Loading...
          </div>
        )}
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
  const [flashMap, setFlashMap] = useState<Record<string, FlashDir>>({});
  const prevValues = useRef<Record<string, number>>({});
  const symbols = useMemo(() => indices.map((i) => i.symbol), [indices]);
  const { data: intradayMap } = useIndicesIntraday(symbols, '5min');

  useEffect(() => {
    const updates: Record<string, FlashDir> = {};
    indices.forEach((idx) => {
      const prev = prevValues.current[idx.symbol];
      if (prev !== undefined && prev !== idx.value) {
        updates[idx.symbol] = idx.value > prev ? 'up' : 'down';
        setTimeout(() => {
          setFlashMap((m) => ({ ...m, [idx.symbol]: null }));
        }, 400);
      }
      prevValues.current[idx.symbol] = idx.value;
    });
    if (Object.keys(updates).length) {
      setFlashMap((m) => ({ ...m, ...updates }));
    }
  }, [indices]);

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
          series={intradayMap?.[index.symbol] ?? []}
          flashDir={flashMap[index.symbol] ?? null}
          onClick={() => navigate(`/market/${index.symbol}`)}
        />
      ))}
    </div>
  );
}
