import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, PieChart, Pie, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PieChart as PieIcon, TrendingUp, Sparkles, Target } from 'lucide-react';

interface AttributionData {
  source: string;
  contribution: number;
  percentage: number;
  color: string;
  type: 'factor' | 'selection' | 'interaction';
}

interface FactorAttributionProps {
  totalReturn?: number;
}

// Generate mock attribution data
function generateAttributionData(totalReturn: number): AttributionData[] {
  // Factor contributions
  const factorContributions = [
    { source: 'Momentum', contribution: 2.1, type: 'factor' as const },
    { source: 'Quality', contribution: 1.8, type: 'factor' as const },
    { source: 'Growth', contribution: 1.5, type: 'factor' as const },
    { source: 'Size', contribution: -0.5, type: 'factor' as const },
    { source: 'Value', contribution: -0.8, type: 'factor' as const },
    { source: 'Volatility', contribution: 0.3, type: 'factor' as const },
    { source: 'Dividend', contribution: -0.2, type: 'factor' as const },
  ];

  const totalFactorContrib = factorContributions.reduce((sum, f) => sum + f.contribution, 0);
  
  // Stock selection (alpha) is the residual
  const stockSelection = totalReturn - totalFactorContrib - 0.8; // Subtract interaction
  const interaction = 0.8; // Factor timing / interaction effects

  const colors = {
    Momentum: '#22c55e',
    Quality: '#3b82f6',
    Growth: '#8b5cf6',
    Size: '#f97316',
    Value: '#ef4444',
    Volatility: '#eab308',
    Dividend: '#06b6d4',
    'Stock Selection': '#10b981',
    'Interaction': '#a855f7',
  };

  const allData: AttributionData[] = [
    ...factorContributions.map(f => ({
      source: f.source,
      contribution: f.contribution,
      percentage: (f.contribution / totalReturn) * 100,
      color: colors[f.source as keyof typeof colors] || '#666',
      type: f.type,
    })),
    {
      source: 'Stock Selection',
      contribution: stockSelection,
      percentage: (stockSelection / totalReturn) * 100,
      color: colors['Stock Selection'],
      type: 'selection' as const,
    },
    {
      source: 'Interaction',
      contribution: interaction,
      percentage: (interaction / totalReturn) * 100,
      color: colors['Interaction'],
      type: 'interaction' as const,
    },
  ];

  return allData.sort((a, b) => b.contribution - a.contribution);
}

export function FactorAttribution({ totalReturn = 14.2 }: FactorAttributionProps) {
  const attributionData = useMemo(() => generateAttributionData(totalReturn), [totalReturn]);
  
  const factorData = attributionData.filter(d => d.type === 'factor');
  const selectionData = attributionData.find(d => d.type === 'selection');
  const interactionData = attributionData.find(d => d.type === 'interaction');
  
  const totalFactorContrib = factorData.reduce((sum, f) => sum + f.contribution, 0);
  const totalSelectionContrib = selectionData?.contribution || 0;
  const totalInteractionContrib = interactionData?.contribution || 0;

  // Pie chart data for high-level breakdown
  const pieData = [
    { name: 'Factor Returns', value: Math.abs(totalFactorContrib), fill: '#3b82f6' },
    { name: 'Stock Selection (α)', value: Math.abs(totalSelectionContrib), fill: '#10b981' },
    { name: 'Interaction', value: Math.abs(totalInteractionContrib), fill: '#a855f7' },
  ];

  // Waterfall data for detailed breakdown
  const waterfallData = [
    { name: 'Benchmark', value: 0, cumulative: 0, fill: '#666' },
    ...factorData.map((f, i) => {
      const prevCumulative = i === 0 ? 0 : factorData.slice(0, i).reduce((s, x) => s + x.contribution, 0);
      return {
        name: f.source,
        value: f.contribution,
        cumulative: prevCumulative + f.contribution,
        fill: f.color,
      };
    }),
    {
      name: 'Selection',
      value: totalSelectionContrib,
      cumulative: totalFactorContrib + totalSelectionContrib,
      fill: '#10b981',
    },
    {
      name: 'Total',
      value: totalReturn,
      cumulative: totalReturn,
      fill: '#22c55e',
      isTotal: true,
    },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <PieIcon className="w-4 h-4" />
            Performance Attribution
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            YTD Return: +{totalReturn.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High-level breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-muted-foreground mb-1">Factor Returns</p>
            <p className={`text-xl font-semibold ${totalFactorContrib >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {totalFactorContrib > 0 ? '+' : ''}{totalFactorContrib.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {((totalFactorContrib / totalReturn) * 100).toFixed(0)}% of total
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Stock Selection (α)</p>
            </div>
            <p className={`text-xl font-semibold ${totalSelectionContrib >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalSelectionContrib > 0 ? '+' : ''}{totalSelectionContrib.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {((totalSelectionContrib / totalReturn) * 100).toFixed(0)}% of total
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs text-muted-foreground mb-1">Interaction</p>
            <p className={`text-xl font-semibold ${totalInteractionContrib >= 0 ? 'text-purple-500' : 'text-red-500'}`}>
              {totalInteractionContrib > 0 ? '+' : ''}{totalInteractionContrib.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              Timing effects
            </p>
          </div>
        </div>

        {/* Waterfall chart */}
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={waterfallData}
              margin={{ top: 10, right: 10, bottom: 20, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string, props: any) => {
                  if (props.payload.isTotal) {
                    return [`${value.toFixed(2)}%`, 'Total Return'];
                  }
                  return [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, 'Contribution'];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Factor breakdown table */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Factor Contribution Details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {factorData.map((factor) => (
              <div key={factor.source} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: factor.color }}
                  />
                  <span className="text-xs">{factor.source}</span>
                </div>
                <span 
                  className="text-xs font-mono"
                  style={{ color: factor.contribution >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {factor.contribution > 0 ? '+' : ''}{factor.contribution.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Alpha analysis */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Alpha Analysis</span>
            </div>
            <Badge 
              variant={totalSelectionContrib > 1 ? 'default' : totalSelectionContrib > 0 ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {totalSelectionContrib > 2 ? 'Strong' : totalSelectionContrib > 0 ? 'Positive' : 'Negative'} Alpha
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-1">Annualized Alpha</p>
              <p className={`text-lg font-semibold ${totalSelectionContrib >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalSelectionContrib > 0 ? '+' : ''}{totalSelectionContrib.toFixed(2)}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-1">Information Ratio</p>
              <p className="text-lg font-semibold text-foreground">
                {(totalSelectionContrib / 4.2).toFixed(2)}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Interpretation:</strong> Your stock selection added{' '}
            <span className="text-emerald-500">{totalSelectionContrib.toFixed(1)}%</span> of return 
            beyond what factor exposures would predict. This alpha comes from security-specific 
            insights rather than systematic factor tilts.
          </p>
        </div>

        {/* Skill vs Luck indicator */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Return Source Breakdown</span>
          </div>
          <div className="flex items-center gap-1 h-4 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.abs(totalFactorContrib / totalReturn) * 100}%` }}
            />
            <div 
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.abs(totalSelectionContrib / totalReturn) * 100}%` }}
            />
            <div 
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${Math.abs(totalInteractionContrib / totalReturn) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Factors ({((totalFactorContrib / totalReturn) * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Selection ({((totalSelectionContrib / totalReturn) * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Interaction ({((totalInteractionContrib / totalReturn) * 100).toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
