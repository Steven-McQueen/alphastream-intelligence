import { useState, useRef, useEffect } from 'react';
import { useMarket } from '@/context/MarketContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, ChevronLeft, TrendingUp, Shield, Bitcoin } from 'lucide-react';

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

export function Watchtower() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { indices, sectorPerformance, cryptoPrices, scrollY } = useMarket();
  const { factorExposures } = usePortfolio();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync scroll with main content
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollY;
    }
  }, [scrollY]);

  if (isCollapsed) {
    return (
      <aside className="flex flex-col items-center w-10 bg-sidebar border-l border-sidebar-border">
        <Button
          variant="ghost"
          size="icon"
          className="mt-2 h-8 w-8"
          onClick={() => setIsCollapsed(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted-foreground writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
            Watchtower
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col w-64 bg-sidebar border-l border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-3 border-b border-sidebar-border">
        <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wide">
          Watchtower
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsCollapsed(true)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="market" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="h-9 w-full justify-start rounded-none border-b border-sidebar-border bg-transparent p-0">
          <TabsTrigger
            value="market"
            className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs"
          >
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Market
          </TabsTrigger>
          <TabsTrigger
            value="risk"
            className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs"
          >
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            My Risk
          </TabsTrigger>
        </TabsList>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto scrollbar-thin"
        >
          <TabsContent value="market" className="mt-0 p-3 space-y-4">
            {/* Indices */}
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Indices
              </h4>
              <div className="space-y-1.5">
                {indices.slice(0, 5).map((index) => (
                  <div key={index.symbol} className="flex items-center justify-between text-xs">
                    <span className="text-sidebar-foreground font-medium">{index.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sidebar-foreground">
                        {index.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span
                        className={cn(
                          'font-mono w-14 text-right',
                          index.changePercent >= 0 ? 'text-positive' : 'text-negative'
                        )}
                      >
                        {index.changePercent >= 0 ? '+' : ''}
                        {index.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Crypto Prices */}
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bitcoin className="h-3 w-3 text-amber-500" />
                Crypto (24h)
              </h4>
              <div className="space-y-1.5">
                {cryptoPrices.slice(0, 6).map((crypto) => (
                  <div key={crypto.symbol} className="flex items-center justify-between text-xs">
                    <span className="text-sidebar-foreground font-medium">{crypto.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sidebar-foreground">
                        ${formatPrice(crypto.price)}
                      </span>
                      <span
                        className={cn(
                          'font-mono w-14 text-right',
                          crypto.changePercent24h >= 0 ? 'text-positive' : 'text-negative'
                        )}
                      >
                        {crypto.changePercent24h >= 0 ? '+' : ''}
                        {crypto.changePercent24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Sectors */}
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Sector Performance (1D)
              </h4>
              <div className="space-y-1.5">
                {[...sectorPerformance]
                  .sort((a, b) => b.change1D - a.change1D)
                  .slice(0, 6)
                  .map((sector) => (
                    <div key={sector.sector} className="flex items-center justify-between text-xs">
                      <span className="text-sidebar-foreground truncate max-w-[120px]">
                        {sector.sector}
                      </span>
                      <span
                        className={cn(
                          'font-mono',
                          sector.change1D >= 0 ? 'text-positive' : 'text-negative'
                        )}
                      >
                        {sector.change1D >= 0 ? '+' : ''}
                        {sector.change1D.toFixed(2)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="mt-0 p-3 space-y-4">
            {/* Factor Exposures */}
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Factor Exposures
              </h4>
              <div className="space-y-2.5">
                {factorExposures.map((factor) => (
                  <div key={factor.factor} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sidebar-foreground">{factor.factor}</span>
                      <span
                        className={cn(
                          'font-mono',
                          factor.exposure >= 0 ? 'text-positive' : 'text-negative'
                        )}
                      >
                        {factor.exposure >= 0 ? '+' : ''}
                        {factor.exposure.toFixed(2)}
                      </span>
                    </div>
                    {/* Exposure bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          factor.exposure >= 0 ? 'bg-positive' : 'bg-negative'
                        )}
                        style={{
                          width: `${Math.min(Math.abs(factor.exposure) * 40, 100)}%`,
                          marginLeft: factor.exposure < 0 ? 'auto' : 0,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Factor Contribution */}
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Return Contribution
              </h4>
              <div className="space-y-1.5">
                {factorExposures.map((factor) => (
                  <div key={factor.factor} className="flex items-center justify-between text-xs">
                    <span className="text-sidebar-foreground">{factor.factor}</span>
                    <span
                      className={cn(
                        'font-mono',
                        factor.contribution >= 0 ? 'text-positive' : 'text-negative'
                      )}
                    >
                      {factor.contribution >= 0 ? '+' : ''}
                      {factor.contribution.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
