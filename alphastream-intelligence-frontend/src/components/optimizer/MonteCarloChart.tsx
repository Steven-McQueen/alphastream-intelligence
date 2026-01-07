import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MonteCarloResult } from '@/data/mockMonteCarlo';
import { generateFanChartData } from '@/data/mockMonteCarlo';

interface MonteCarloChartProps {
  result: MonteCarloResult;
  initialValue: number;
  timeHorizonYears: number;
}

export function MonteCarloChart({ result, initialValue, timeHorizonYears }: MonteCarloChartProps) {
  const fanData = useMemo(() => {
    // Sample simulations for performance (use first 500)
    const sampledSims = result.simulations.slice(0, 500);
    return generateFanChartData(sampledSims, initialValue);
  }, [result.simulations, initialValue]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Projection Fan Chart</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {timeHorizonYears}Y Horizon
            </Badge>
            <Badge variant="outline" className="text-xs">
              {result.simulations.length.toLocaleString()} Paths
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fanData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <defs>
                <linearGradient id="p5p95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="p25p75" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="month"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(m) => `${Math.floor(m / 12)}Y`}
                interval={11}
                label={{ value: 'Time', position: 'bottom', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                label={{ value: 'Return (%)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    p5: '5th Percentile',
                    p25: '25th Percentile',
                    p50: 'Median',
                    p75: '75th Percentile',
                    p95: '95th Percentile',
                  };
                  return [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, labels[name] || name];
                }}
                labelFormatter={(month) => `Month ${month} (Year ${(month / 12).toFixed(1)})`}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              
              {/* 5-95 percentile band */}
              <Area
                type="monotone"
                dataKey="p95"
                stackId="band1"
                stroke="none"
                fill="url(#p5p95)"
              />
              <Area
                type="monotone"
                dataKey="p5"
                stackId="band1"
                stroke="none"
                fill="hsl(var(--background))"
              />
              
              {/* 25-75 percentile band */}
              <Area
                type="monotone"
                dataKey="p75"
                stackId="band2"
                stroke="none"
                fill="url(#p25p75)"
              />
              <Area
                type="monotone"
                dataKey="p25"
                stackId="band2"
                stroke="none"
                fill="hsl(var(--background))"
              />
              
              {/* Median line */}
              <Area
                type="monotone"
                dataKey="p50"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-2 bg-primary/10 rounded" />
            <span>5th-95th</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-2 bg-primary/25 rounded" />
            <span>25th-75th</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-primary rounded" />
            <span>Median</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
