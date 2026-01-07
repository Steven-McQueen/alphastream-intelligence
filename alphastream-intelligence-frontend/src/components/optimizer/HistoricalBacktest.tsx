import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

type TimePeriod = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX';

interface PerformancePoint {
  date: string;
  portfolio: number;
  benchmark: number;
  excess: number;
}

interface PeriodStats {
  period: TimePeriod;
  portfolioReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
}

// Generate historical performance data
function generateHistoricalData(months: number): PerformancePoint[] {
  const data: PerformancePoint[] = [];
  let portfolioValue = 100;
  let benchmarkValue = 100;
  
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  // Monthly returns with some correlation
  for (let i = 0; i <= months; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    
    // Simulate returns with portfolio having slight alpha
    const marketReturn = (Math.random() - 0.45) * 8; // Slight positive bias
    const alpha = (Math.random() - 0.4) * 2; // Slight positive alpha
    const portfolioReturn = marketReturn + alpha;
    
    portfolioValue *= (1 + portfolioReturn / 100);
    benchmarkValue *= (1 + marketReturn / 100);
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      portfolio: portfolioValue - 100,
      benchmark: benchmarkValue - 100,
      excess: (portfolioValue - 100) - (benchmarkValue - 100),
    });
  }
  
  return data;
}

// Generate period statistics
function generatePeriodStats(): PeriodStats[] {
  return [
    { period: '1M', portfolioReturn: 2.3, benchmarkReturn: 1.8, excessReturn: 0.5, volatility: 12.5, sharpe: 1.2, maxDrawdown: -3.2, winRate: 58 },
    { period: '3M', portfolioReturn: 5.8, benchmarkReturn: 4.2, excessReturn: 1.6, volatility: 14.2, sharpe: 1.1, maxDrawdown: -5.8, winRate: 62 },
    { period: '6M', portfolioReturn: 9.4, benchmarkReturn: 7.1, excessReturn: 2.3, volatility: 15.8, sharpe: 1.0, maxDrawdown: -8.4, winRate: 59 },
    { period: '1Y', portfolioReturn: 14.2, benchmarkReturn: 10.5, excessReturn: 3.7, volatility: 16.5, sharpe: 0.95, maxDrawdown: -12.1, winRate: 61 },
    { period: '3Y', portfolioReturn: 42.5, benchmarkReturn: 32.8, excessReturn: 9.7, volatility: 18.2, sharpe: 0.88, maxDrawdown: -18.5, winRate: 58 },
    { period: '5Y', portfolioReturn: 78.3, benchmarkReturn: 58.2, excessReturn: 20.1, volatility: 17.8, sharpe: 0.92, maxDrawdown: -24.2, winRate: 60 },
  ];
}

const PERIOD_MONTHS: Record<TimePeriod, number> = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 12,
  '3Y': 36,
  '5Y': 60,
  'MAX': 120,
};

export function HistoricalBacktest() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1Y');
  
  const chartData = useMemo(() => 
    generateHistoricalData(PERIOD_MONTHS[selectedPeriod]), 
    [selectedPeriod]
  );
  
  const periodStats = useMemo(() => generatePeriodStats(), []);
  const currentStats = periodStats.find(s => s.period === selectedPeriod) || periodStats[3];

  // Calculate drawdown series
  const drawdownData = useMemo(() => {
    let peak = 0;
    return chartData.map(d => {
      const value = d.portfolio;
      if (value > peak) peak = value;
      const drawdown = peak > 0 ? ((value - peak) / (100 + peak)) * 100 : 0;
      return { ...d, drawdown };
    });
  }, [chartData]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <History className="w-4 h-4" />
            Historical Backtest
          </CardTitle>
          <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as TimePeriod)}>
            <TabsList className="h-7">
              {(['1M', '3M', '6M', '1Y', '3Y', '5Y'] as TimePeriod[]).map(period => (
                <TabsTrigger key={period} value={period} className="text-xs px-2 h-5">
                  {period}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Portfolio</p>
            <p className={`text-lg font-semibold ${currentStats.portfolioReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {currentStats.portfolioReturn > 0 ? '+' : ''}{currentStats.portfolioReturn.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Benchmark</p>
            <p className={`text-lg font-semibold ${currentStats.benchmarkReturn >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {currentStats.benchmarkReturn > 0 ? '+' : ''}{currentStats.benchmarkReturn.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Excess Return</p>
            <p className={`text-lg font-semibold ${currentStats.excessReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {currentStats.excessReturn > 0 ? '+' : ''}{currentStats.excessReturn.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">Max Drawdown</p>
            <p className="text-lg font-semibold text-red-500">
              {currentStats.maxDrawdown.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Performance chart */}
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={drawdownData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
                    portfolio: 'Portfolio',
                    benchmark: 'Benchmark (S&P 500)',
                    drawdown: 'Drawdown',
                  };
                  return [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, labels[name] || name];
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    portfolio: 'Portfolio',
                    benchmark: 'S&P 500',
                  };
                  return labels[value] || value;
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="portfolio"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#portfolioGradient)"
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Period comparison table */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Period Comparison</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Period</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Return</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">vs Bench</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Vol</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Sharpe</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {periodStats.map((stat) => (
                  <tr 
                    key={stat.period} 
                    className={`border-b border-border/50 ${stat.period === selectedPeriod ? 'bg-secondary/50' : ''}`}
                  >
                    <td className="py-2 font-medium">{stat.period}</td>
                    <td className={`py-2 text-right font-mono ${stat.portfolioReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {stat.portfolioReturn > 0 ? '+' : ''}{stat.portfolioReturn.toFixed(1)}%
                    </td>
                    <td className={`py-2 text-right font-mono ${stat.excessReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {stat.excessReturn > 0 ? '+' : ''}{stat.excessReturn.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">
                      {stat.volatility.toFixed(1)}%
                    </td>
                    <td className={`py-2 text-right font-mono ${stat.sharpe >= 1 ? 'text-emerald-500' : 'text-foreground'}`}>
                      {stat.sharpe.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono text-red-500">
                      {stat.maxDrawdown.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key insights */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">Outperformance</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Portfolio beat benchmark in {currentStats.winRate}% of months with 
              +{currentStats.excessReturn.toFixed(1)}% cumulative excess return.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-amber-500">Risk Note</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Max drawdown of {currentStats.maxDrawdown.toFixed(1)}% occurred during 
              market stress. Higher volatility than benchmark.
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground italic">
          Past performance is not indicative of future results. Backtest results are hypothetical 
          and do not reflect actual trading. Actual results may differ due to fees, slippage, and market conditions.
        </p>
      </CardContent>
    </Card>
  );
}
