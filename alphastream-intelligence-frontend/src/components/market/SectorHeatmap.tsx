import { useState } from 'react';
import { useMarket } from '@/context/MarketContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Sector } from '@/types';

type TimeFrame = '1D' | '1W' | '1M' | '1Y';

const SECTOR_SHORT_NAMES: Record<Sector, string> = {
  'Technology': 'Tech',
  'Healthcare': 'Health',
  'Financials': 'Fins',
  'Consumer Discretionary': 'Disc',
  'Consumer Staples': 'Staples',
  'Industrials': 'Indus',
  'Energy': 'Energy',
  'Materials': 'Mats',
  'Utilities': 'Utils',
  'Real Estate': 'RE',
  'Communication Services': 'Comm',
};

export function SectorHeatmap() {
  const { sectorPerformance } = useMarket();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1D');

  const getPerformanceValue = (sector: typeof sectorPerformance[0]) => {
    switch (timeFrame) {
      case '1D':
        return sector.change1D;
      case '1W':
        return sector.change1W;
      case '1M':
        return sector.change1M;
      case '1Y':
        return sector.change1Y;
    }
  };

  // Sort by performance for current timeframe
  const sortedSectors = [...sectorPerformance].sort(
    (a, b) => getPerformanceValue(b) - getPerformanceValue(a)
  );

  // Calculate min/max for color scaling
  const values = sortedSectors.map(getPerformanceValue);
  const maxAbs = Math.max(Math.abs(Math.min(...values)), Math.abs(Math.max(...values)));

  const getBackgroundColor = (value: number) => {
    const intensity = Math.min(Math.abs(value) / maxAbs, 1);
    if (value > 0) {
      return `hsla(142, 71%, 45%, ${0.15 + intensity * 0.5})`;
    } else if (value < 0) {
      return `hsla(0, 84%, 60%, ${0.15 + intensity * 0.5})`;
    }
    return 'hsla(var(--muted), 0.3)';
  };

  const getTextColor = (value: number) => {
    if (value > 0) return 'text-positive';
    if (value < 0) return 'text-negative';
    return 'text-muted-foreground';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Sector Performance</CardTitle>
          <Tabs value={timeFrame} onValueChange={(v) => setTimeFrame(v as TimeFrame)}>
            <TabsList className="h-7">
              <TabsTrigger value="1D" className="text-xs h-6 px-2">1D</TabsTrigger>
              <TabsTrigger value="1W" className="text-xs h-6 px-2">1W</TabsTrigger>
              <TabsTrigger value="1M" className="text-xs h-6 px-2">1M</TabsTrigger>
              <TabsTrigger value="1Y" className="text-xs h-6 px-2">1Y</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {sortedSectors.map((sector) => {
            const value = getPerformanceValue(sector);
            return (
              <div
                key={sector.sector}
                className="p-2.5 rounded-md border border-border/50 transition-all hover:border-border"
                style={{ backgroundColor: getBackgroundColor(value) }}
              >
                <div className="text-[10px] text-muted-foreground font-medium mb-1 truncate">
                  {SECTOR_SHORT_NAMES[sector.sector]}
                </div>
                <div className={cn('text-sm font-mono font-semibold', getTextColor(value))}>
                  {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-negative/50" />
            <span>Underperform</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-positive/50" />
            <span>Outperform</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
