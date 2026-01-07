import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, TrendingDown, Target } from 'lucide-react';

type RollingPeriod = '6M' | '12M' | '24M' | '36M';

interface RollingReturnPoint {
  date: string;
  return: number;
  benchmark: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
}

// Generate rolling return data
function generateRollingReturns(rollingMonths: number): RollingReturnPoint[] {
  const data: RollingReturnPoint[] = [];
  const totalMonths = 60; // 5 years of history
  
  // Generate historical percentile bands (based on historical distribution)
  const historicalMean = 10;
  const historicalVol = 15;
  
  for (let i = rollingMonths; i <= totalMonths; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - (totalMonths - i));
    
    // Simulate rolling return with mean reversion and volatility clustering
    const cycleFactor = Math.sin((i / 12) * Math.PI) * 5;
    const noise = (Math.random() - 0.5) * 20;
    const portfolioReturn = historicalMean + cycleFactor + noise;
    const benchmarkReturn = portfolioReturn - (Math.random() * 4 - 1); // Slight alpha
    
    // Historical percentile bands
    const p5 = historicalMean - 1.65 * historicalVol + cycleFactor * 0.3;
    const p25 = historicalMean - 0.67 * historicalVol + cycleFactor * 0.5;
    const p75 = historicalMean + 0.67 * historicalVol + cycleFactor * 0.5;
    const p95 = historicalMean + 1.65 * historicalVol + cycleFactor * 0.3;
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      return: portfolioReturn,
      benchmark: benchmarkReturn,
      p5,
      p25,
      p75,
      p95,
    });
  }
  
  return data;
}

// Calculate distribution statistics
function calculateStats(data: RollingReturnPoint[]) {
  const returns = data.map(d => d.return);
  const sorted = [...returns].sort((a, b) => a - b);
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  const getPercentile = (p: number) => sorted[Math.floor(p * sorted.length)];
  
  const positiveMonths = returns.filter(r => r > 0).length;
  const negativeMonths = returns.filter(r => r < 0).length;
  
  const currentReturn = returns[returns.length - 1];
  const currentPercentile = (sorted.filter(r => r < currentReturn).length / sorted.length) * 100;
  
  return {
    mean,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: getPercentile(0.05),
    p25: getPercentile(0.25),
    median: getPercentile(0.5),
    p75: getPercentile(0.75),
    p95: getPercentile(0.95),
    positiveMonths,
    negativeMonths,
    winRate: (positiveMonths / returns.length) * 100,
    currentReturn,
    currentPercentile,
  };
}

const PERIOD_MONTHS: Record<RollingPeriod, number> = {
  '6M': 6,
  '12M': 12,
  '24M': 24,
  '36M': 36,
};

export function RollingReturns() {
  const [rollingPeriod, setRollingPeriod] = useState<RollingPeriod>('12M');
  
  const data = useMemo(() => 
    generateRollingReturns(PERIOD_MONTHS[rollingPeriod]), 
    [rollingPeriod]
  );
  
  const stats = useMemo(() => calculateStats(data), [data]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Rolling Returns Analysis
          </CardTitle>
          <Tabs value={rollingPeriod} onValueChange={(v) => setRollingPeriod(v as RollingPeriod)}>
            <TabsList className="h-7">
              {(['6M', '12M', '24M', '36M'] as RollingPeriod[]).map(period => (
                <TabsTrigger key={period} value={period} className="text-xs px-2 h-5">
                  {period}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current status */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Current {rollingPeriod}</p>
            <p className={`text-lg font-semibold ${stats.currentReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.currentReturn > 0 ? '+' : ''}{stats.currentReturn.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Percentile</p>
            <p className={`text-lg font-semibold ${stats.currentPercentile > 50 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {stats.currentPercentile.toFixed(0)}th
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Average</p>
            <p className={`text-lg font-semibold ${stats.mean >= 0 ? 'text-foreground' : 'text-red-500'}`}>
              {stats.mean > 0 ? '+' : ''}{stats.mean.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Win Rate</p>
            <p className={`text-lg font-semibold ${stats.winRate > 60 ? 'text-emerald-500' : 'text-foreground'}`}>
              {stats.winRate.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Rolling returns chart with bands */}
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="band95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="band75" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                domain={['dataMin - 5', 'dataMax + 5']}
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
                    return: `${rollingPeriod} Rolling Return`,
                    benchmark: 'Benchmark',
                    p95: '95th Percentile',
                    p75: '75th Percentile',
                    p25: '25th Percentile',
                    p5: '5th Percentile',
                  };
                  return [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, labels[name] || name];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <ReferenceLine y={stats.mean} stroke="hsl(var(--primary))" strokeDasharray="5 5" strokeOpacity={0.5} />
              
              {/* 5-95 percentile band */}
              <Area
                type="monotone"
                dataKey="p95"
                stroke="none"
                fill="url(#band95)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="p5"
                stroke="none"
                fill="hsl(var(--background))"
                fillOpacity={1}
              />
              
              {/* 25-75 percentile band */}
              <Area
                type="monotone"
                dataKey="p75"
                stroke="none"
                fill="url(#band75)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="p25"
                stroke="none"
                fill="hsl(var(--background))"
                fillOpacity={1}
              />
              
              {/* Benchmark line */}
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                strokeOpacity={0.6}
              />
              
              {/* Portfolio rolling return */}
              <Line
                type="monotone"
                dataKey="return"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-emerald-500 rounded" />
            <span>Portfolio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-blue-500 rounded opacity-60" />
            <span>Benchmark</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2 bg-primary/20 rounded" />
            <span>25th-75th %ile</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2 bg-primary/10 rounded" />
            <span>5th-95th %ile</span>
          </div>
        </div>

        {/* Distribution stats */}
        <div className="grid grid-cols-5 gap-2 pt-3 border-t border-border">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">5th %ile</p>
            <p className="text-sm font-mono text-red-500">{stats.p5.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">25th %ile</p>
            <p className="text-sm font-mono text-amber-500">{stats.p25.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Median</p>
            <p className="text-sm font-mono text-foreground">{stats.median.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">75th %ile</p>
            <p className="text-sm font-mono text-emerald-500">{stats.p75.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">95th %ile</p>
            <p className="text-sm font-mono text-emerald-500">{stats.p95.toFixed(1)}%</p>
          </div>
        </div>

        {/* Range and volatility */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Historical Range</span>
              <Badge variant="outline" className="text-[10px]">{rollingPeriod} Rolling</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                <span className="text-xs font-mono text-red-500">{stats.min.toFixed(1)}%</span>
              </div>
              <div className="flex-1 h-1.5 bg-gradient-to-r from-red-500 via-foreground to-emerald-500 rounded-full" />
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="text-xs font-mono text-emerald-500">{stats.max.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Rolling Volatility</span>
              <Target className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold">{stats.stdDev.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">std deviation</span>
            </div>
          </div>
        </div>

        {/* Current context */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Current Context:</strong> The trailing {rollingPeriod} return of{' '}
            <span className={stats.currentReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}>
              {stats.currentReturn > 0 ? '+' : ''}{stats.currentReturn.toFixed(1)}%
            </span>{' '}
            is in the <span className="text-primary">{stats.currentPercentile.toFixed(0)}th percentile</span> of 
            historical {rollingPeriod} returns. {stats.currentPercentile > 75 
              ? 'This is an above-average period—consider rebalancing if overweight.' 
              : stats.currentPercentile < 25 
                ? 'This is a below-average period—historically followed by recovery.' 
                : 'This is within the normal historical range.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
