import { useMarket } from '@/context/MarketContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Command } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { InlineTicker } from './InlineTicker';

interface TopBarProps {
  title: string;
  onCommandPaletteOpen?: () => void;
}

export function TopBar({ title, onCommandPaletteOpen }: TopBarProps) {
  const { isMarketOpen, regime, marketState } = useMarket();

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4 flex-shrink-0">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-medium',
            isMarketOpen
              ? 'border-positive/50 text-positive bg-positive/10'
              : 'border-muted-foreground/50 text-muted-foreground bg-muted/50'
          )}
        >
          Market: {marketState.status}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-medium',
            regime === 'Risk-On' && 'border-positive/50 text-positive bg-positive/10',
            regime === 'Risk-Off' && 'border-negative/50 text-negative bg-negative/10',
            regime === 'Neutral' && 'border-warning/50 text-warning bg-warning/10'
          )}
        >
          Regime: {regime}
        </Badge>
      </div>

      <InlineTicker />

      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onCommandPaletteOpen}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md border border-border hover:bg-accent transition-colors"
        >
          <Command className="h-3 w-3" />
          <span>K</span>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
