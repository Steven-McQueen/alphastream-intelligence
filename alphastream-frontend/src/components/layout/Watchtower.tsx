import { useState, useRef, useEffect } from 'react';
import { useMarket } from '@/contexts/MarketContext';
import { useStockDetail } from '@/contexts/StockDetailContext';
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
  const { openIndexDetail } = useStockDetail();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync scroll with main content
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollY;
    }
  }, [scrollY]);

  if (isCollapsed) {
    return (
      <aside className="flex flex-col items-center w-8 bg-background border-l border-border">
        <Button
          variant="ghost"
          size="icon"
          className="mt-3 h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setIsCollapsed(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex flex-col items-center justify-center">
          <span 
            className="text-[10px] text-dim font-medium tracking-widest" 
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            WATCHTOWER
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col w-[280px] bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-positive" />
          <span className="text-sm font-semibold text-foreground">Watchtower</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={refreshMarketData}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Market Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isMarketOpen ? "bg-positive animate-pulse" : "bg-dim"
          )} />
          <span className="text-xs text-muted-foreground">
            Market {isMarketOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-dim">
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
            <BarChart3 className="w-3.5 h-3.5 text-dim" />
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Market Indices
            </h4>
          </div>
          <div className="space-y-2">
            {indices.slice(0, 5).map((index) => {
              const isPositive = (index.changePercent ?? 0) >= 0;
              return (
                <div 
                  key={index.symbol} 
                  className="flex items-center justify-between p-2.5 bg-card/50 rounded-lg border border-border/50 hover:border-secondary transition-colors cursor-pointer"
                  onClick={() => openIndexDetail({ symbol: index.symbol, name: index.name })}
                >
                  <div>
                    <span className="text-xs font-medium text-foreground">{index.symbol}</span>
                    <div className="text-[10px] text-dim mt-0.5">{index.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-foreground">
                      {formatPrice(index.value ?? 0)}
                    </div>
                    <div className={cn(
                      "text-[10px] font-mono flex items-center justify-end gap-0.5",
                      isPositive ? "text-positive" : "text-negative"
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
            <TrendingUp className="w-3.5 h-3.5 text-dim" />
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                      <span className="text-[11px] text-soft truncate max-w-[140px] group-hover:text-foreground transition-colors">
                        {sector.sector}
                      </span>
                      <span className={cn(
                        "text-[11px] font-mono",
                        isPositive ? "text-positive" : "text-negative"
                      )}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isPositive ? "bg-positive/60" : "bg-negative/60"
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
              <Activity className="w-3.5 h-3.5 text-dim" />
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                    className="p-2.5 bg-card/50 rounded-lg border border-border/50"
                  >
                    <div className="text-[10px] text-dim truncate mb-1">
                      {indicator.name}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-mono text-foreground">
                        {typeof indicator.value === 'number' 
                          ? indicator.value.toFixed(indicator.unit === '%' ? 2 : 1)
                          : indicator.value}
                      </span>
                      <span className="text-[9px] text-dim">{indicator.unit}</span>
                    </div>
                    {change !== 0 && (
                      <div className={cn(
                        "text-[10px] font-mono mt-0.5",
                        isPositive ? "text-positive" : "text-negative"
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
            <TrendingUp className="w-3.5 h-3.5 text-positive" />
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                  className="flex items-center gap-3 p-2 bg-positive/10 rounded-lg border border-positive/20"
                >
                  <div className="w-5 h-5 rounded-full bg-positive/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-positive">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-foreground truncate block">{sector.sector}</span>
                  </div>
                  <span className="text-[11px] font-mono text-positive">
                    +{(sector.change1D ?? 0).toFixed(2)}%
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Bottom Movers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-3.5 h-3.5 text-negative" />
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                  className="flex items-center gap-3 p-2 bg-negative/10 rounded-lg border border-red-500/20"
                >
                  <div className="w-5 h-5 rounded-full bg-negative/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-negative">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-foreground truncate block">{sector.sector}</span>
                  </div>
                  <span className="text-[11px] font-mono text-negative">
                    {(sector.change1D ?? 0).toFixed(2)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-card/30">
        <div className="flex items-center justify-between text-[10px] text-dim">
          <span>Last updated</span>
          <span>{new Date(marketState.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
    </aside>
  );
}
