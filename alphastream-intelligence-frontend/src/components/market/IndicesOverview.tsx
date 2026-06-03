import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMarket } from '@/contexts/MarketContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { useIndicesIntraday } from '@/hooks/useIndicesIntraday';

type FlashDir = 'up' | 'down' | null;

/**
 * Price value that animates on change: a brief color flash (green/red) plus a
 * subtle slide that settles back to the foreground color — a clean, Perplexity-
 * style tick. Replays by remounting via an incrementing key.
 */
function AnimatedPrice({ value }: { value: number }) {
  const prevRef = useRef(value);
  const dirRef = useRef<FlashDir>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (prevRef.current !== value) {
      dirRef.current = value > prevRef.current ? 'up' : 'down';
      prevRef.current = value;
      setTick((t) => t + 1);
    }
  }, [value]);

  return (
    <span
      key={tick}
      className={cn(
        'inline-block text-2xl font-semibold tabular-nums text-foreground',
        dirRef.current === 'up' && 'animate-[price-tick-up_0.55s_ease-out]',
        dirRef.current === 'down' && 'animate-[price-tick-down_0.55s_ease-out]'
      )}
      style={{ fontFamily: 'var(--font-widget-heading)' }}
    >
      {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

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
      ? 'bg-positive/10'
      : flashDir === 'down'
        ? 'bg-negative/10'
        : '';
  
  const Trend = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card
      className={cn(
        "flex h-full flex-col p-4 bg-sidebar-accent border-border overflow-hidden cursor-pointer hover:bg-muted/50 transition-all",
        flashClass
      )}
      style={{
        transition: 'background-color 0.3s ease',
      }}
      onClick={onClick}
    >
      {/* Header — name block reserves 2 lines so charts/prices align across cards */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-tight text-foreground"
            style={{ fontFamily: 'var(--font-page-heading)' }}
          >
            {name}
          </div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>{symbol}</div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums',
            isPositive
              ? 'border-positive/20 bg-positive/10 text-positive'
              : 'border-negative/20 bg-negative/10 text-negative'
          )}
        >
          <Trend className="h-3 w-3" strokeWidth={2.5} />
          {Math.abs(changePercent).toFixed(2)}%
        </span>
      </div>

      {/* Sparkline Chart */}
      <div className="h-16 -mx-2 my-3">
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
      
      {/* Current value + absolute change — pinned to bottom so prices align across cards */}
      <div className="mt-auto flex items-end justify-between gap-2">
        <AnimatedPrice value={value} />
        <span className="pb-0.5 text-xs font-medium tabular-nums text-dim">
          {change >= 0 ? '+' : ''}{change.toFixed(2)}
        </span>
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
