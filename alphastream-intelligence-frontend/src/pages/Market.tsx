import { useRef, useCallback } from 'react';
import { MacroIndicators } from '@/components/market/MacroIndicators';
import { SectorHeatmap } from '@/components/market/SectorHeatmap';
import { MacroCharts } from '@/components/market/MacroCharts';
import { IndicesOverview } from '@/components/market/IndicesOverview';
import { MarketNewsSummary } from '@/components/market/MarketNewsSummary';
import { useMarket } from '@/context/MarketContext';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { LiveBadge } from '@/components/ui/LiveBadge';

export default function Market() {
  const { refreshMarketData, isLoading, marketState, setScrollY } = useMarket();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUpdated = marketState?.lastUpdated;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollY(target.scrollTop);
  }, [setScrollY]);

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex flex-col h-full p-4 gap-4 overflow-auto scrollbar-thin"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Market Overview</h2>
          <LiveBadge lastUpdated={lastUpdated} isLoading={isLoading} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={refreshMarketData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Market Indices with Sparkline Charts */}
      <IndicesOverview />

      {/* Middle Row: Sector Heatmap + Macro Indicators */}
      <div className="grid grid-cols-2 gap-4">
        <SectorHeatmap />
        <MacroIndicators />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4">
        <MacroCharts />
      </div>

      {/* Bottom Row: Market News Summary */}
      <div className="grid grid-cols-1 gap-4">
        <MarketNewsSummary />
      </div>
    </div>
  );
}
