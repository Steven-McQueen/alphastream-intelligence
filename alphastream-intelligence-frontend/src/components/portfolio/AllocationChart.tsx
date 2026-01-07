import { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Sector } from '@/types';

const SECTOR_COLORS: Record<Sector, string> = {
  'Technology': 'hsl(217, 91%, 60%)',
  'Healthcare': 'hsl(142, 71%, 45%)',
  'Financials': 'hsl(38, 92%, 50%)',
  'Consumer Discretionary': 'hsl(280, 65%, 60%)',
  'Consumer Staples': 'hsl(340, 75%, 55%)',
  'Industrials': 'hsl(200, 70%, 50%)',
  'Energy': 'hsl(25, 95%, 53%)',
  'Materials': 'hsl(160, 60%, 45%)',
  'Utilities': 'hsl(45, 85%, 55%)',
  'Real Estate': 'hsl(190, 70%, 50%)',
  'Communication Services': 'hsl(260, 60%, 55%)',
};

const STRATEGY_COLORS = {
  'Core Quality': 'hsl(217, 91%, 60%)',
  'Growth': 'hsl(142, 71%, 45%)',
  'Tactical': 'hsl(38, 92%, 50%)',
  'Macro Bet': 'hsl(280, 65%, 60%)',
  'Income': 'hsl(340, 75%, 55%)',
};

export function AllocationChart() {
  const { holdings, sectorAllocation } = usePortfolio();

  // Sector data for pie chart
  const sectorData = useMemo(() => {
    return Object.entries(sectorAllocation)
      .map(([sector, data]) => ({
        name: sector,
        value: data.weight,
        amount: data.value,
        color: SECTOR_COLORS[sector as Sector] || 'hsl(var(--muted))',
      }))
      .sort((a, b) => b.value - a.value);
  }, [sectorAllocation]);

  // Strategy data for pie chart
  const strategyData = useMemo(() => {
    const strategyMap: Record<string, { value: number; weight: number }> = {};
    
    holdings.forEach((h) => {
      if (!strategyMap[h.strategy]) {
        strategyMap[h.strategy] = { value: 0, weight: 0 };
      }
      strategyMap[h.strategy].value += h.marketValue;
      strategyMap[h.strategy].weight += h.weight;
    });

    return Object.entries(strategyMap)
      .map(([strategy, data]) => ({
        name: strategy,
        value: data.weight,
        amount: data.value,
        color: STRATEGY_COLORS[strategy as keyof typeof STRATEGY_COLORS] || 'hsl(var(--muted))',
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-lg">
          <p className="text-sm font-medium">{data.name}</p>
          <p className="text-xs text-muted-foreground">
            {data.value.toFixed(1)}% · ${data.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (data: typeof sectorData) => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
      {data.slice(0, 8).map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground truncate">{entry.name}</span>
          <span className="font-mono ml-auto">{entry.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sector">
          <TabsList className="h-8 mb-3">
            <TabsTrigger value="sector" className="text-xs h-7">
              By Sector
            </TabsTrigger>
            <TabsTrigger value="strategy" className="text-xs h-7">
              By Strategy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sector" className="mt-0">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {renderLegend(sectorData)}
          </TabsContent>

          <TabsContent value="strategy" className="mt-0">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strategyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {strategyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {renderLegend(strategyData)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
