import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '@/context/MarketContext';
import { useStockDetail } from '@/contexts/StockDetailContext';
import { API_BASE_URL } from '@/config/api';

interface TickerItem {
  symbol: string;
  value: number;
  changePercent: number;
}

export function InlineTicker() {
  const [isPaused, setIsPaused] = useState(false);
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const navigate = useNavigate();
  const { isMarketOpen } = useMarket();
  const { openStockDetail } = useStockDetail();
  const idxRef = useRef(0);

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/macro/ticker-all`);
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
        setSymbols(formatted.map((f: any) => f.symbol));
      } catch (error) {
        console.error('❌ Ticker fetch failed:', error);
        setTickerData([]);
      }
    };

    fetchTicker();
    // keep a slower base refresh for list integrity
    const interval = setInterval(fetchTicker, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Live staggered update: cycle through symbols rapidly for fresh visual updates
  // Updates 2-3 symbols every 2 seconds for smooth, frequent price changes
  useEffect(() => {
    if (!isMarketOpen || !symbols.length) return;
    let cancelled = false;

    const tick = async () => {
      // Update 2-3 symbols per tick for smoothness
      const batchSize = 3;
      const startIdx = idxRef.current;
      const batch = symbols.slice(startIdx, startIdx + batchSize);
      idxRef.current = (startIdx + batchSize) % symbols.length;

      for (const sym of batch) {
        if (cancelled) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/live/quote?symbol=${encodeURIComponent(sym)}`);
          if (!res.ok) continue;
          const quote = await res.json();
          if (cancelled || quote.error || quote.value === null) continue;

          setTickerData((prev) => {
            const next = [...prev];
            const i = next.findIndex((x) => x.symbol === sym);
            if (i >= 0) {
              next[i] = {
                symbol: quote.symbol,
                value: quote.value ?? quote.price ?? next[i].value,
                changePercent: quote.changePercent ?? next[i].changePercent ?? 0,
              };
            }
            return next;
          });
        } catch (err) {
          // Single fetch error, continue to next
        }
      }
    };

    // Fast updates - every 2 seconds
    tick();
    const id = setInterval(tick, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isMarketOpen, symbols]);

  const loopedData = useMemo(
    () => (tickerData.length ? [...tickerData, ...tickerData, ...tickerData] : []),
    [tickerData]
  );

  const handleClick = (symbol: string) => {
    // Check if symbol is an index (starts with ^) or a macro indicator
    const isIndex = symbol.startsWith('^');
    const isMacro = ['US10Y', 'US2Y', 'DXY', 'GOLD', 'WTI', 'BTC-USD', 'ETH-USD'].includes(symbol);
    
    if (isIndex) {
      // Navigate to index detail page
      navigate(`/market/${encodeURIComponent(symbol)}`);
    } else if (isMacro) {
      // For macro indicators, navigate to market page
      navigate('/market');
    } else {
      // For stocks, open the stock detail sheet
      openStockDetail({ ticker: symbol, name: symbol } as any);
    }
  };

  if (!tickerData.length) {
    return (
      <div className="flex-1 mx-4 flex items-center justify-center">
        <span className="text-xs text-negative">
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
            className="flex items-center space-x-2.5 flex-shrink-0 group cursor-pointer transition-all duration-150 hover:scale-[1.03] active:scale-95"
            onClick={() => handleClick(item.symbol)}
          >
            <span className="text-[11px] font-semibold tracking-wide text-dim group-hover:text-sidebar-foreground transition-colors duration-100">
              {item.symbol}
            </span>
            <span className="text-[13px] font-medium text-sidebar-foreground tabular-nums">
              {item.value.toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })}
            </span>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                item.changePercent >= 0
                  ? 'text-positive'
                  : 'text-negative'
              }`}
            >
              {item.changePercent >= 0 ? '+' : ''}
              {item.changePercent.toFixed(2)}%
            </span>
            <span className="text-border text-xs mx-1">- </span>
          </div>
        ))}
      </div>
    </div>
  );
}

