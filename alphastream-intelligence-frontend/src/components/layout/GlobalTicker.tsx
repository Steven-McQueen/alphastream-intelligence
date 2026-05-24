import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalTicker, TickerItem } from '@/hooks/useGlobalTicker';

const TickerRow = memo(function TickerRow({ item, onClick }: { item: TickerItem; onClick: () => void }) {
  const positive = (item.changePercent ?? 0) >= 0;
  return (
    <div
      onClick={onClick}
      className="flex items-center space-x-2 px-4 py-2 cursor-pointer hover:bg-card/50 transition-colors whitespace-nowrap flex-shrink-0"
    >
      <span className="text-xs font-semibold text-soft">{item.symbol}</span>
      <span className="text-xs font-mono text-foreground">
        {formatValue(item.value, item.displayFormat)}
      </span>
      <span className={`text-xs font-mono ${positive ? 'text-positive' : 'text-negative'}`}>
        {positive ? '▲' : '▼'}
        {Math.abs(item.changePercent).toFixed(2)}%
      </span>
      <span className="text-dim text-sm">|</span>
    </div>
  );
});

function formatValue(value: number, format?: string) {
  if (format === 'percent') return `${value.toFixed(2)}%`;
  if (format === 'currency') {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toFixed(2);
}

export function GlobalTicker() {
  const { data: tickerData, isLoading } = useGlobalTicker();
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  const isMobile = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false),
    []
  );

  const displayData = useMemo(() => {
    if (!tickerData) return [];
    const sliced = isMobile ? tickerData.slice(0, 6) : tickerData;
    // duplicate for seamless scroll
    return [...sliced, ...sliced, ...sliced];
  }, [tickerData, isMobile]);

  const handleTickerClick = (symbol: string, name: string) => {
    navigate(`/intelligence?q=Analyze ${name} (${symbol}) - what's driving today's move?`);
  };

  if (isLoading || !tickerData) {
    return (
      <div className="h-10 bg-black border-b border-border flex items-center px-4">
        <div className="text-xs text-dim animate-pulse">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="relative h-10 bg-black border-b border-border overflow-hidden">
      <div
        className={`flex items-center h-full ${isPaused ? '' : 'animate-ticker'}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {displayData.map((item, index) => (
          <TickerRow
            key={`${item.symbol}-${index}`}
            item={item}
            onClick={() => handleTickerClick(item.symbol, item.name)}
          />
        ))}
      </div>
    </div>
  );
}

