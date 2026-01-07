import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
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
import { GitBranch, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { generateDivergenceData } from '@/data/mockSimulation';

export function DivergenceTracking() {
  const divergenceData = useMemo(() => generateDivergenceData(12), []);

  // Calculate statistics
  const stats = useMemo(() => {
    const divergences = divergenceData.map((d) => d.divergence);
    const cumulative = divergenceData[divergenceData.length - 1]?.cumulativeDivergence || 0;
    const avgDivergence = divergences.reduce((a, b) => a + b, 0) / divergences.length;
    const maxPositive = Math.max(...divergences);
    const maxNegative = Math.min(...divergences);
    
    // Count months where portfolio outperformed
    const outperformMonths = divergences.filter((d) => d > 0).length;
    const underperformMonths = divergences.filter((d) => d < 0).length;
    
    return {
      cumulative,
      avgDivergence,
      maxPositive,
      maxNegative,
      outperformMonths,
      underperformMonths,
      totalMonths: divergences.length,
    };
  }, [divergenceData]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-md ${
                stats.cumulative >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {stats.cumulative >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">Cumulative</span>
            </div>
            <p className={`text-xl font-mono font-semibold ${
              stats.cumulative >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {stats.cumulative >= 0 ? '+' : ''}{stats.cumulative.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              vs Shadow Portfolio
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <GitBranch className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Avg Monthly</span>
            </div>
            <p className={`text-xl font-mono font-semibold ${
              stats.avgDivergence >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {stats.avgDivergence >= 0 ? '+' : ''}{stats.avgDivergence.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Mean divergence
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-green-500/10">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground">Best Month</span>
            </div>
            <p className="text-xl font-mono font-semibold text-green-500">
              +{stats.maxPositive.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Peak outperformance
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-red-500/10">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground">Worst Month</span>
            </div>
            <p className="text-xl font-mono font-semibold text-red-500">
              {stats.maxNegative.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Peak underperformance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Divergence Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Monthly Divergence</CardTitle>
            <div className="flex gap-2">
              <Badge variant={stats.outperformMonths > stats.underperformMonths ? 'default' : 'secondary'}>
                {stats.outperformMonths} outperform
              </Badge>
              <Badge variant={stats.underperformMonths > stats.outperformMonths ? 'destructive' : 'secondary'}>
                {stats.underperformMonths} underperform
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divergenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Divergence']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Bar dataKey="divergence" radius={[4, 4, 0, 0]}>
                  {divergenceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.divergence >= 0 ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(0 72.2% 50.6%)'}
                      opacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Divergence Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Cumulative Divergence Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={divergenceData}>
                <defs>
                  <linearGradient id="divergenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Cumulative']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="cumulativeDivergence"
                  stroke="hsl(var(--primary))"
                  fill="url(#divergenceGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Divergence Breakdown Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Monthly Return Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Month</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Portfolio</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Shadow</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Divergence</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {divergenceData.slice(-6).map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 px-3">
                      {new Date(row.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                    </td>
                    <td className={`text-right py-2 px-3 font-mono ${
                      row.portfolioReturn >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {row.portfolioReturn >= 0 ? '+' : ''}{row.portfolioReturn.toFixed(2)}%
                    </td>
                    <td className={`text-right py-2 px-3 font-mono ${
                      row.shadowReturn >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {row.shadowReturn >= 0 ? '+' : ''}{row.shadowReturn.toFixed(2)}%
                    </td>
                    <td className={`text-right py-2 px-3 font-mono font-medium ${
                      row.divergence >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {row.divergence >= 0 ? '+' : ''}{row.divergence.toFixed(2)}%
                    </td>
                    <td className={`text-right py-2 px-3 font-mono ${
                      row.cumulativeDivergence >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {row.cumulativeDivergence >= 0 ? '+' : ''}{row.cumulativeDivergence.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
