import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MonteCarloResult } from '@/data/mockMonteCarlo';
import { generateHistogramData } from '@/data/mockMonteCarlo';

interface DistributionChartProps {
  result: MonteCarloResult;
  initialValue: number;
  targetReturn: number;
}

export function DistributionChart({ result, initialValue, targetReturn }: DistributionChartProps) {
  const histogramData = useMemo(() => {
    return generateHistogramData(result.finalValues, initialValue, 40);
  }, [result.finalValues, initialValue]);

  const medianReturn = ((result.percentiles.p50 - initialValue) / initialValue) * 100;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Return Distribution</CardTitle>
          <Badge variant="outline" className="text-xs">
            Histogram
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
              <XAxis
                dataKey="midpoint"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${v}%`}
                interval="preserveStartEnd"
                label={{ value: 'Total Return (%)', position: 'bottom', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Frequency']}
                labelFormatter={(label) => `Return: ${label}%`}
              />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: 'Break-even', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <ReferenceLine x={Math.round(medianReturn)} stroke="hsl(var(--primary))" strokeWidth={2} label={{ value: 'Median', fill: 'hsl(var(--primary))', fontSize: 10 }} />
              <ReferenceLine x={Math.round(targetReturn)} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" label={{ value: 'Target', fill: '#10b981', fontSize: 10 }} />
              <Bar dataKey="frequency" radius={[2, 2, 0, 0]}>
                {histogramData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.midpoint < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-border">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">5th %ile</p>
            <p className={`text-sm font-mono font-medium ${((result.percentiles.p5 - initialValue) / initialValue) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {(((result.percentiles.p5 - initialValue) / initialValue) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Median</p>
            <p className="text-sm font-mono font-medium text-primary">
              +{medianReturn.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">95th %ile</p>
            <p className="text-sm font-mono font-medium text-emerald-500">
              +{(((result.percentiles.p95 - initialValue) / initialValue) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volatility</p>
            <p className="text-sm font-mono font-medium text-amber-500">
              {result.volatilityOfOutcomes.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
