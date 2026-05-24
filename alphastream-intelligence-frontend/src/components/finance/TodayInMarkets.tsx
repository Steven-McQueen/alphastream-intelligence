import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';

interface SectorData {
  sector: string;
  change1D: number;
  change1W: number;
  change1M: number;
  stockCount: number;
}

type TimeFrame = '1D' | '1W' | '1M';

export function TodayInMarkets() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1D');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/market/sectors`);
        const data = await response.json();
        setSectors(data);
      } catch (error) {
        console.error('Error fetching sectors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSectors();
    const interval = setInterval(fetchSectors, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getChangeForTimeFrame = (sector: SectorData) => {
    switch (timeFrame) {
      case '1W':
        return sector.change1W;
      case '1M':
        return sector.change1M;
      case '1D':
      default:
        return sector.change1D;
    }
  };

  if (loading) {
    return (
      <Card className="bg-sidebar-accent border-border h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-widget-heading)' }}>Today in Markets</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/40 animate-pulse">
                <div className="h-3 bg-muted rounded mb-2 w-2/3" />
                <div className="h-5 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-sidebar-accent border-border h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-widget-heading)' }}>Today in Markets</CardTitle>
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
            {(['1D', '1W', '1M'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  timeFrame === tf
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-4 gap-2">
          {sectors.map((sector) => {
            const change = getChangeForTimeFrame(sector);
            const isPositive = change >= 0;
            return (
              <div
                key={sector.sector}
                className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-muted-foreground mb-1 truncate">
                  {sector.sector}
                </div>
                <div
                  className={cn(
                    'text-base font-semibold font-mono',
                    isPositive ? 'text-positive' : 'text-negative'
                  )}
                >
                  {isPositive ? '+' : ''}
                  {change.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
