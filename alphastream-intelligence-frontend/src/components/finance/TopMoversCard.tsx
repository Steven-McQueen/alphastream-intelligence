import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { getTopMovers } from '@/data/mockFinanceHome';

type MoversTab = 'gainers' | 'losers' | 'volume';

export function TopMoversCard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MoversTab>('gainers');
  const movers = getTopMovers(tab);

  const handleRowClick = (ticker: string) => {
    const prompt = `Explain today's move in ${ticker} and whether it's justified fundamentally.`;
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="bg-sidebar-accent rounded-xl p-6 border border-border h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-widget-heading)' }}>Top Movers</h2>
        <ToggleGroup
          type="single"
          value={tab}
          onValueChange={(v) => v && setTab(v as MoversTab)}
          className="h-7"
        >
          <ToggleGroupItem
            value="gainers"
            className="h-6 px-2 text-xs data-[state=on]:bg-positive/20 data-[state=on]:text-positive"
          >
            Gainers
          </ToggleGroupItem>
          <ToggleGroupItem
            value="losers"
            className="h-6 px-2 text-xs data-[state=on]:bg-negative/20 data-[state=on]:text-negative"
          >
            Losers
          </ToggleGroupItem>
          <ToggleGroupItem
            value="volume"
            className="h-6 px-2 text-xs data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
          >
            Volume
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-1">
        {movers.slice(0, 6).map((mover) => (
          <div
            key={mover.ticker}
            onClick={() => handleRowClick(mover.ticker)}
            className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono font-semibold text-sm w-14">{mover.ticker}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">{mover.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                {mover.sector.split(' ')[0]}
              </span>
              <span className={cn(
                'font-mono text-xs font-medium w-16 text-right',
                mover.change1D >= 0 ? 'text-positive' : 'text-negative'
              )}>
                {mover.change1D >= 0 ? '+' : ''}{mover.change1D.toFixed(2)}%
              </span>
              {tab === 'volume' && (
                <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">
                  {mover.volumeRatio.toFixed(1)}x
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
