import { useState, useRef, useEffect } from 'react';
import { useMarket } from '@/context/MarketContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, 
  ChevronLeft, 
  TrendingUp, 
  TrendingDown,
  Activity,
  BarChart3,
  RefreshCw,
  Clock
} from 'lucide-react';

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function Watchtower() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { 
    indices, 
    sectorPerformance, 
    macroIndicators,
    marketState,
    isMarketOpen,
    refreshMarketData,
    isLoading,
    scrollY 
  } = useMarket();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync scroll with main content
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollY;
    }
  }, [scrollY]);

  if (isCollapsed) {
    return (
      <aside className="flex flex-col items-center w-8 bg-zinc-950 border-l border-zinc-800">
        <Button
          variant="ghost"
          size="icon"
          className="mt-3 h-6 w-6 text-zinc-400 hover:text-white hover:bg-zinc-800"
          onClick={() => setIsCollapsed(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex flex-col items-center justify-center">
          <span 
            className="text-[10px] text-zinc-600 font-medium tracking-widest" 
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            WATCHTOWER
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col w-[280px] bg-zinc-950 border-l border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Watchtower</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={refreshMarketData}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Market Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isMarketOpen ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
          )} />
          <span className="text-xs text-zinc-400">
            Market {isMarketOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Clock className="w-3 h-3" />
          <span>{formatRelativeTime(marketState.lastUpdated)}</span>
        </div>
      </div>

      {/* Content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5"
      >
        {/* Market Indices */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Market Indices
            </h4>
          </div>
          <div className="space-y-2">
            {indices.slice(0, 5).map((index) => {
              const isPositive = (index.changePercent ?? 0) >= 0;
              return (
                <div 
                  key={index.symbol} 
                  className="flex items-center justify-between p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <span className="text-xs font-medium text-white">{index.symbol}</span>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{index.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-white">
                      {formatPrice(index.value ?? 0)}
                    </div>
                    <div className={cn(
                      "text-[10px] font-mono flex items-center justify-end gap-0.5",
                      isPositive ? "text-emerald-400" : "text-red-400"
                    )}>
                      {isPositive ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      {isPositive ? '+' : ''}{(index.changePercent ?? 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sector Performance */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Sectors (1D)
            </h4>
          </div>
          <div className="space-y-1.5">
            {[...sectorPerformance]
              .sort((a, b) => (b.change1D ?? 0) - (a.change1D ?? 0))
              .slice(0, 8)
              .map((sector) => {
                const change = sector.change1D ?? 0;
                const isPositive = change >= 0;
                const barWidth = Math.min(Math.abs(change) * 8, 100);
                
                return (
                  <div key={sector.sector} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-zinc-300 truncate max-w-[140px] group-hover:text-white transition-colors">
                        {sector.sector}
                      </span>
                      <span className={cn(
                        "text-[11px] font-mono",
                        isPositive ? "text-emerald-400" : "text-red-400"
                      )}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isPositive ? "bg-emerald-500/60" : "bg-red-500/60"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Macro Indicators */}
        {macroIndicators.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-zinc-500" />
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Key Indicators
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {macroIndicators.slice(0, 6).map((indicator) => {
                const change = indicator.change ?? 0;
                const isPositive = change >= 0;
                
                return (
                  <div 
                    key={indicator.name}
                    className="p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-800/50"
                  >
                    <div className="text-[10px] text-zinc-500 truncate mb-1">
                      {indicator.name}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-mono text-white">
                        {typeof indicator.value === 'number' 
                          ? indicator.value.toFixed(indicator.unit === '%' ? 2 : 1)
                          : indicator.value}
                      </span>
                      <span className="text-[9px] text-zinc-500">{indicator.unit}</span>
                    </div>
                    {change !== 0 && (
                      <div className={cn(
                        "text-[10px] font-mono mt-0.5",
                        isPositive ? "text-emerald-400" : "text-red-400"
                      )}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Movers Preview */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Top Sectors
            </h4>
          </div>
          <div className="space-y-2">
            {[...sectorPerformance]
              .sort((a, b) => (b.change1D ?? 0) - (a.change1D ?? 0))
              .slice(0, 3)
              .map((sector, idx) => (
                <div 
                  key={sector.sector}
                  className="flex items-center gap-3 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-emerald-400">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-white truncate block">{sector.sector}</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">
                    +{(sector.change1D ?? 0).toFixed(2)}%
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Bottom Movers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Bottom Sectors
            </h4>
          </div>
          <div className="space-y-2">
            {[...sectorPerformance]
              .sort((a, b) => (a.change1D ?? 0) - (b.change1D ?? 0))
              .slice(0, 3)
              .map((sector, idx) => (
                <div 
                  key={sector.sector}
                  className="flex items-center gap-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20"
                >
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-red-400">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-white truncate block">{sector.sector}</span>
                  </div>
                  <span className="text-[11px] font-mono text-red-400">
                    {(sector.change1D ?? 0).toFixed(2)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Last updated</span>
          <span>{new Date(marketState.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
    </aside>
  );
}
