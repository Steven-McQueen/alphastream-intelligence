import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { getSectorTiles } from '@/data/mockFinanceHome';

type Period = '1D' | '1W' | '1M';

export function SectorPerformanceCard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('1D');
  const sectors = getSectorTiles(period);

  const getChangeValue = (sector: typeof sectors[0]) => {
    switch (period) {
      case '1D': return sector.change1D;
      case '1W': return sector.change1W;
      case '1M': return sector.change1M;
    }
  };

  const handleSectorClick = (sectorName: string) => {
    const prompt = `Analyze the current setup for ${sectorName} and find mispriced quality names.`;
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Sector Performance</CardTitle>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as Period)}
            className="h-7"
          >
            {(['1D', '1W', '1M'] as Period[]).map((p) => (
              <ToggleGroupItem
                key={p}
                value={p}
                className="h-6 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {p}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {sectors.map((sector) => {
            const change = getChangeValue(sector);
            const intensity = Math.min(Math.abs(change) / 4, 1);
            const bgOpacity = 0.1 + intensity * 0.3;
            
            return (
              <div
                key={sector.sector}
                onClick={() => handleSectorClick(sector.sector)}
                className={cn(
                  'rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.02]',
                  'border border-border/50 hover:border-border'
                )}
                style={{
                  backgroundColor: change >= 0
                    ? `hsla(142, 71%, 45%, ${bgOpacity})`
                    : `hsla(0, 84%, 60%, ${bgOpacity})`,
                }}
              >
                <div className="text-xs font-medium truncate">{sector.sector}</div>
                <div className={cn(
                  'text-sm font-mono font-semibold mt-0.5',
                  change >= 0 ? 'text-positive' : 'text-negative'
                )}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
