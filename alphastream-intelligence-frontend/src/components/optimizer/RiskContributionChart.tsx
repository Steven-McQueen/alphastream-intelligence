import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, AlertTriangle } from 'lucide-react';
import { generateRiskContributions, type HoldingRiskContribution } from '@/data/mockMonteCarlo';
import { useMemo } from 'react';

interface RiskContributionChartProps {
  portfolioVaR: number;
}

export function RiskContributionChart({ portfolioVaR }: RiskContributionChartProps) {
  const contributions = useMemo(() => generateRiskContributions(portfolioVaR), [portfolioVaR]);
  
  // Top 5 for chart
  const topContributors = contributions.slice(0, 8);
  
  // Color scale from high risk (red) to low risk (green)
  const getColor = (contribution: number) => {
    if (contribution > 20) return '#ef4444'; // red
    if (contribution > 15) return '#f97316'; // orange
    if (contribution > 10) return '#eab308'; // yellow
    if (contribution > 5) return '#22c55e'; // green
    return '#06b6d4'; // cyan
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Risk Contribution by Holding
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Component VaR
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bar chart */}
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topContributors}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                domain={[0, 'dataMax + 5']}
              />
              <YAxis
                type="category"
                dataKey="ticker"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, 'Risk Contribution']}
                labelFormatter={(label) => {
                  const holding = contributions.find(c => c.ticker === label);
                  return holding ? `${holding.ticker} - ${holding.name}` : label;
                }}
              />
              <Bar dataKey="contributionPct" radius={[0, 4, 4, 0]}>
                {topContributors.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.contributionPct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed breakdown table */}
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          <div className="grid grid-cols-12 gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-2 sticky top-0 bg-card pb-1 border-b border-border">
            <div className="col-span-2">Ticker</div>
            <div className="col-span-2 text-right">Weight</div>
            <div className="col-span-2 text-right">Vol</div>
            <div className="col-span-2 text-right">Beta</div>
            <div className="col-span-4">Risk Contrib.</div>
          </div>
          
          {contributions.map((holding) => (
            <div
              key={holding.ticker}
              className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors"
            >
              <div className="col-span-2">
                <span className="font-medium text-sm">{holding.ticker}</span>
              </div>
              <div className="col-span-2 text-right text-sm text-muted-foreground">
                {holding.weight.toFixed(1)}%
              </div>
              <div className="col-span-2 text-right text-sm text-muted-foreground">
                {holding.volatility}%
              </div>
              <div className="col-span-2 text-right text-sm">
                <span className={holding.beta > 1.2 ? 'text-amber-500' : holding.beta < 0.8 ? 'text-blue-500' : 'text-muted-foreground'}>
                  {holding.beta.toFixed(2)}
                </span>
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <Progress
                  value={holding.contributionPct}
                  className="h-2 flex-1"
                  style={{
                    ['--progress-background' as string]: getColor(holding.contributionPct),
                  }}
                />
                <span className="text-xs font-mono w-10 text-right" style={{ color: getColor(holding.contributionPct) }}>
                  {holding.contributionPct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Risk concentration warning */}
        {contributions[0].contributionPct > 25 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-500">High Risk Concentration</p>
              <p className="text-xs text-amber-200/80">
                {contributions[0].ticker} contributes {contributions[0].contributionPct.toFixed(1)}% of portfolio risk. 
                Consider diversifying to reduce concentration risk.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Risk Contribution Legend</p>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>&gt;20%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>15-20%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span>10-15%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>5-10%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-cyan-500" />
              <span>&lt;5%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
