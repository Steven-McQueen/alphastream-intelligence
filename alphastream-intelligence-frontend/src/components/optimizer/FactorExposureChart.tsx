import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { FactorExposure, Factor } from '@/types';

interface FactorExposureChartProps {
  exposures?: FactorExposure[];
}

// Factor descriptions for tooltips
const FACTOR_INFO: Record<Factor, { description: string; positive: string; negative: string }> = {
  'Momentum': {
    description: 'Stocks with strong recent price performance',
    positive: 'Tilted toward winners',
    negative: 'Tilted toward laggards',
  },
  'Value': {
    description: 'Stocks trading at low multiples relative to fundamentals',
    positive: 'Cheap stocks overweight',
    negative: 'Expensive stocks overweight',
  },
  'Quality': {
    description: 'Profitable, stable companies with low leverage',
    positive: 'High-quality tilt',
    negative: 'Lower-quality tilt',
  },
  'Size': {
    description: 'Market capitalization exposure',
    positive: 'Small-cap tilt',
    negative: 'Large-cap tilt',
  },
  'Volatility': {
    description: 'Stock price volatility exposure',
    positive: 'High-volatility tilt',
    negative: 'Low-volatility tilt',
  },
  'Growth': {
    description: 'Companies with high earnings/revenue growth',
    positive: 'Growth stocks overweight',
    negative: 'Mature companies overweight',
  },
  'Dividend Yield': {
    description: 'High dividend-paying stocks',
    positive: 'Income-focused',
    negative: 'Growth/reinvestment focused',
  },
};

// Generate mock factor exposures if not provided
function generateMockExposures(): FactorExposure[] {
  return [
    { factor: 'Momentum', exposure: 0.85, contribution: 2.1 },
    { factor: 'Quality', exposure: 1.2, contribution: 1.8 },
    { factor: 'Growth', exposure: 0.65, contribution: 1.5 },
    { factor: 'Value', exposure: -0.45, contribution: -0.8 },
    { factor: 'Size', exposure: -0.75, contribution: -0.5 },
    { factor: 'Volatility', exposure: 0.55, contribution: 0.3 },
    { factor: 'Dividend Yield', exposure: -0.35, contribution: -0.2 },
  ];
}

function getExposureColor(exposure: number): string {
  const absExp = Math.abs(exposure);
  if (absExp > 1) return exposure > 0 ? '#22c55e' : '#ef4444';
  if (absExp > 0.5) return exposure > 0 ? '#84cc16' : '#f97316';
  return '#a3a3a3';
}

function getExposureLabel(exposure: number): string {
  const absExp = Math.abs(exposure);
  if (absExp > 1.5) return 'Very High';
  if (absExp > 1) return 'High';
  if (absExp > 0.5) return 'Moderate';
  if (absExp > 0.25) return 'Low';
  return 'Minimal';
}

export function FactorExposureChart({ exposures }: FactorExposureChartProps) {
  const factorData = useMemo(() => {
    const data = exposures || generateMockExposures();
    return data.map(f => ({
      ...f,
      absExposure: Math.abs(f.exposure),
      color: getExposureColor(f.exposure),
    })).sort((a, b) => b.absExposure - a.absExposure);
  }, [exposures]);

  const totalContribution = factorData.reduce((sum, f) => sum + f.contribution, 0);
  const dominantFactor = factorData[0];
  const riskFactors = factorData.filter(f => Math.abs(f.exposure) > 0.75);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Factor Exposures
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Z-Score
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Factor exposure bar chart */}
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={factorData}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={true} vertical={false} />
              <XAxis
                type="number"
                domain={[-2, 2]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <YAxis
                type="category"
                dataKey="factor"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)} σ`, 'Exposure']}
                labelFormatter={(label) => {
                  const info = FACTOR_INFO[label as Factor];
                  return info ? `${label}: ${info.description}` : label;
                }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
              <ReferenceLine x={-1} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <ReferenceLine x={1} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Bar dataKey="exposure" radius={[0, 4, 4, 0]}>
                {factorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Factor detail table */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-2 pb-1 border-b border-border">
            <div className="col-span-3">Factor</div>
            <div className="col-span-3 text-right">Exposure</div>
            <div className="col-span-3 text-right">Contribution</div>
            <div className="col-span-3 text-right">Intensity</div>
          </div>
          
          {factorData.map((factor) => {
            const info = FACTOR_INFO[factor.factor];
            const interpretation = factor.exposure > 0 ? info?.positive : info?.negative;
            
            return (
              <div
                key={factor.factor}
                className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors"
              >
                <div className="col-span-3 flex items-center gap-1.5">
                  <span className="font-medium text-sm">{factor.factor}</span>
                  <UITooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      <p className="text-xs">{info?.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{interpretation}</p>
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="col-span-3 text-right">
                  <span 
                    className="font-mono text-sm"
                    style={{ color: factor.color }}
                  >
                    {factor.exposure > 0 ? '+' : ''}{factor.exposure.toFixed(2)}σ
                  </span>
                </div>
                <div className="col-span-3 text-right">
                  <span className={`font-mono text-sm ${factor.contribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {factor.contribution > 0 ? '+' : ''}{factor.contribution.toFixed(1)}%
                  </span>
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.min(100, factor.absExposure * 50)}
                      className="h-1.5 flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground w-12 text-right">
                      {getExposureLabel(factor.exposure)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Dominant Factor</p>
            <p className="text-sm font-semibold" style={{ color: dominantFactor.color }}>
              {dominantFactor.factor}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {dominantFactor.exposure > 0 ? '+' : ''}{dominantFactor.exposure.toFixed(2)}σ exposure
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Factor Return</p>
            <p className={`text-sm font-semibold ${totalContribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalContribution > 0 ? '+' : ''}{totalContribution.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              Contribution from factors
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Active Factors</p>
            <p className="text-sm font-semibold text-foreground">
              {riskFactors.length} of {factorData.length}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Above 0.75σ threshold
            </p>
          </div>
        </div>

        {/* Factor tilt summary */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs font-medium mb-2">Portfolio Style Summary</p>
          <div className="flex flex-wrap gap-1.5">
            {factorData
              .filter(f => Math.abs(f.exposure) > 0.4)
              .map(f => (
                <Badge
                  key={f.factor}
                  variant="secondary"
                  className="text-xs"
                  style={{ 
                    backgroundColor: `${f.color}20`,
                    color: f.color,
                    borderColor: f.color,
                  }}
                >
                  {f.exposure > 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  {f.exposure > 0 ? 'Long' : 'Short'} {f.factor}
                </Badge>
              ))}
          </div>
        </div>

        {/* Interpretation */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Interpretation:</strong> Your portfolio has a{' '}
            <span style={{ color: factorData.find(f => f.factor === 'Quality')?.color }}>quality</span> and{' '}
            <span style={{ color: factorData.find(f => f.factor === 'Momentum')?.color }}>momentum</span> tilt,
            favoring profitable companies with strong recent performance. The negative{' '}
            <span style={{ color: factorData.find(f => f.factor === 'Value')?.color }}>value</span> exposure
            indicates a growth bias with higher valuations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
