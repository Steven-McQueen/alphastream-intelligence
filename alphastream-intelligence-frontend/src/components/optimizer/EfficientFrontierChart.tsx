import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EfficientFrontierPoint } from '@/types';

interface EfficientFrontierChartProps {
  frontierPoints: EfficientFrontierPoint[];
  currentPortfolio: EfficientFrontierPoint;
  optimalPortfolio: EfficientFrontierPoint;
  targetVolatility: number;
}

export function EfficientFrontierChart({
  frontierPoints,
  currentPortfolio,
  optimalPortfolio,
  targetVolatility,
}: EfficientFrontierChartProps) {
  // Transform data for recharts
  const frontierData = frontierPoints.map((p) => ({
    x: p.volatility,
    y: p.expectedReturn,
    type: 'frontier',
  }));

  const currentData = [{
    x: currentPortfolio.volatility,
    y: currentPortfolio.expectedReturn,
    type: 'current',
  }];

  const optimalData = [{
    x: optimalPortfolio.volatility,
    y: optimalPortfolio.expectedReturn,
    type: 'optimal',
  }];

  const improvement = optimalPortfolio.expectedReturn - currentPortfolio.expectedReturn;
  const sharpeImprovement = ((optimalPortfolio.sharpeRatio - currentPortfolio.sharpeRatio) / currentPortfolio.sharpeRatio * 100);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Efficient Frontier</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
              Current
            </Badge>
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
              Optimal
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                type="number"
                dataKey="x"
                name="Volatility"
                unit="%"
                domain={['dataMin - 2', 'dataMax + 2']}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                label={{ value: 'Volatility (%)', position: 'bottom', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Return"
                unit="%"
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                label={{ value: 'Expected Return (%)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)}%`,
                  name === 'x' ? 'Volatility' : 'Return'
                ]}
              />
              <ReferenceLine
                x={targetVolatility}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                opacity={0.6}
              />
              {/* Frontier curve */}
              <Scatter
                name="Frontier"
                data={frontierData}
                fill="hsl(var(--primary))"
                fillOpacity={0.6}
                line={{ stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                shape="circle"
                r={3}
              />
              {/* Current portfolio */}
              <Scatter
                name="Current"
                data={currentData}
                fill="#f59e0b"
                shape="diamond"
                r={8}
              />
              {/* Optimal portfolio */}
              <Scatter
                name="Optimal"
                data={optimalData}
                fill="#10b981"
                shape="star"
                r={8}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Improvement metrics */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Return Improvement</p>
            <p className="text-lg font-semibold text-emerald-500">
              +{improvement.toFixed(2)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Sharpe Improvement</p>
            <p className="text-lg font-semibold text-emerald-500">
              +{sharpeImprovement.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Target Volatility</p>
            <p className="text-lg font-semibold text-foreground">
              {targetVolatility.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
