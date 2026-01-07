import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TickerItem {
  symbol: string;
  value: number;
  changePercent: number;
}

export function InlineTicker() {
  const [isPaused, setIsPaused] = useState(false);
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/macro/ticker-all');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const validData = data.filter((item: any) => {
          if (item.value === null || item.value === undefined) {
            console.warn(`⚠ Skipping ${item.symbol}: NULL value`);
            return false;
          }
          if (item.error) {
            console.warn(`⚠ Skipping ${item.symbol}: ${item.error}`);
            return false;
          }
          return true;
        });

        if (!validData.length) {
          console.error('❌ No valid ticker data available');
          setTickerData([]);
          return;
        }

        const formatted = validData.map((item: any) => ({
          symbol: item.symbol,
          value: item.value,
          changePercent:
            item.changePercent ??
            item.change_percent ??
            item.change_pct ??
            item.changePct ??
            item.change ??
            0,
        }));

        setTickerData(formatted);
      } catch (error) {
        console.error('❌ Ticker fetch failed:', error);
        setTickerData([]);
      }
    };

    fetchTicker();
    const interval = setInterval(fetchTicker, 30000);
    return () => clearInterval(interval);
  }, []);

  const loopedData = useMemo(
    () => (tickerData.length ? [...tickerData, ...tickerData, ...tickerData] : []),
    [tickerData]
  );

  const handleClick = (symbol: string) => {
    navigate(`/intelligence?q=Analyze ${symbol}: what's driving today's move?`);
  };

  if (!tickerData.length) {
    return (
      <div className="flex-1 mx-4 flex items-center justify-center">
        <span className="text-xs text-red-400">
          ⚠ Ticker data unavailable - check backend logs
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden flex-1 mx-4 ticker-font"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 92%, transparent 100%)',
      }}
    >
      <div 
        className={`flex items-center space-x-6 whitespace-nowrap ${
          isPaused ? '' : 'animate-ticker-inline'
        }`}
      >
        {loopedData.map((item, index) => (
          <div
            key={`${item.symbol}-${index}`}
            className="flex items-center space-x-2.5 flex-shrink-0 group cursor-pointer transition-all duration-200 hover:scale-105"
            onClick={() => handleClick(item.symbol)}
          >
            <span className="text-[11px] font-semibold tracking-wide text-zinc-400 group-hover:text-zinc-200 transition-colors">
              {item.symbol}
            </span>
            <span className="text-[13px] font-medium text-zinc-100 tabular-nums">
              {item.value.toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })}
            </span>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                item.changePercent >= 0 
                  ? 'text-emerald-400' 
                  : 'text-red-400'
              }`}
            >
              {item.changePercent >= 0 ? '+' : ''}
              {item.changePercent.toFixed(2)}%
            </span>
            <span className="text-zinc-800 text-xs mx-1">- </span>
          </div>
        ))}
      </div>
    </div>
  );
}

