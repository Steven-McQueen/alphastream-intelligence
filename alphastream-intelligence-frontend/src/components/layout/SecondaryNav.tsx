import { useLocation, Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useMarket } from '@/context/MarketContext';
import { useStockDetail } from '@/contexts/StockDetailContext';
import { API_BASE_URL } from '@/config/api';
import { cn } from '@/lib/utils';

const NAV_TABS = [
  { path: '/', label: 'Overview' },
  { path: '/news', label: 'News' },
  { path: '/intelligence', label: 'Intelligence' },
  { path: '/screener', label: 'Screener' },
  { path: '/earnings', label: 'Earnings' },
  { path: '/politicians', label: 'Politicians' },
  { path: '/watchlist', label: 'Watchlist' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/optimizer', label: 'Optimizer' },
];

/* ── VIX → Score mapping ── */
// Score: +100 (extreme bullish, VIX=10) → 0 (neutral, VIX=17.5) → -100 (extreme bearish, VIX=40)
const vixToScore = (vix: number): number => {
  const neutral = 17.5;
  const bullRange = neutral - 10;   // 7.5
  const bearRange = 40 - neutral;   // 22.5
  const raw = vix <= neutral
    ? ((neutral - vix) / bullRange) * 100
    : ((neutral - vix) / bearRange) * 100;
  return Math.max(-100, Math.min(100, raw));
};

/* ── VIX Sentiment Indicator ── */
function SentimentIndicator() {
  const { indices } = useMarket();
  const vixIndex = indices.find((i) => i.symbol === 'VIX' || i.symbol === '^VIX');
  const vixValue = vixIndex?.value ?? 18;
  const score = vixToScore(vixValue); // +100 to -100

  // Sentiment label based on score thresholds
  let sentimentLabel: string;
  let sentimentColor: string;
  if (score >= 73) {
    sentimentLabel = 'Extreme Bullish';
    sentimentColor = 'text-positive';
  } else if (score >= 47) {
    sentimentLabel = 'Bullish';
    sentimentColor = 'text-positive';
  } else if (score >= 20) {
    sentimentLabel = 'Moderately Bullish';
    sentimentColor = 'text-positive';
  } else if (score > 0) {
    sentimentLabel = 'Mildly Bullish';
    sentimentColor = 'text-positive/80';
  } else if (score > -11) {
    sentimentLabel = 'Neutral';
    sentimentColor = 'text-muted-foreground';
  } else if (score > -33) {
    sentimentLabel = 'Mildly Bearish';
    sentimentColor = 'text-amber-400';
  } else if (score > -56) {
    sentimentLabel = 'Moderately Bearish';
    sentimentColor = 'text-orange-400';
  } else if (score > -78) {
    sentimentLabel = 'Bearish';
    sentimentColor = 'text-negative';
  } else if (score > -100) {
    sentimentLabel = 'Very Bearish';
    sentimentColor = 'text-red-500';
  } else {
    sentimentLabel = 'Extreme Bearish';
    sentimentColor = 'text-red-500';
  }

  // 10 bars: indices 0-4 are LEFT (bearish side), 5-9 are RIGHT (bullish side)
  // Score maps to how many bars fill from center outward:
  //   score +100 → 5 bars fill rightward (green)
  //   score -100 → 5 bars fill leftward (red)
  //   score 0    → center, no fill
  // Each bar = 20 score units (100 / 5 bars)

  const fillBars = Math.abs(score) / 20; // 0 to 5

  function getBarColor(barIndex: number): string {
    // Bars 0-4: left side (bearish, red), bar 4 is closest to center
    // Bars 5-9: right side (bullish, green), bar 5 is closest to center
    if (score >= 0) {
      // Bullish: fill bars from center (5) rightward (to 9)
      const distFromCenter = barIndex - 5; // -5 to 4 for bars 0-9
      if (distFromCenter >= 0 && distFromCenter < fillBars) {
        return 'bg-positive';
      }
      // Partially filled bar
      if (distFromCenter >= 0 && distFromCenter < fillBars + 1 && fillBars % 1 > 0) {
        const partial = fillBars % 1;
        if (partial >= 0.5) return 'bg-positive/60';
      }
      return 'bg-secondary';
    } else {
      // Bearish: fill bars from center (4) leftward (to 0)
      const distFromCenter = 4 - barIndex; // 0 at bar 4, 4 at bar 0
      if (distFromCenter >= 0 && distFromCenter < fillBars) {
        return 'bg-red-400';
      }
      if (distFromCenter >= 0 && distFromCenter < fillBars + 1 && fillBars % 1 > 0) {
        const partial = fillBars % 1;
        if (partial >= 0.5) return 'bg-red-400/60';
      }
      return 'bg-secondary';
    }
  }

  // All bars same height — straight vertical bars, no curve
  const BAR_HEIGHT = 14;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-[2px] h-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn('w-[3px] rounded-[1px] transition-colors', getBarColor(i))}
            style={{ height: `${BAR_HEIGHT}px` }}
          />
        ))}
      </div>
      <span className={cn('text-xs font-medium whitespace-nowrap', sentimentColor)}>
        {sentimentLabel}
      </span>
    </div>
  );
}

/* ── Stock Search Widget ── */
interface SearchResult {
  ticker: string;
  name: string;
  price?: number;
  change1D?: number;
}

function StockSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const { openStockDetail } = useStockDetail();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/universe/search?q=${encodeURIComponent(value.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setShowDropdown(true);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleSelect = (stock: SearchResult) => {
    openStockDetail({
      ticker: stock.ticker,
      name: stock.name,
      price: stock.price ?? 0,
      change1D: stock.change1D ?? 0,
    } as any);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-dim pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search for stocks, crypto, and more..."
          className="h-7 w-56 rounded-full border border-secondary bg-muted/80 pl-8 pr-3 text-xs text-foreground placeholder:text-dim focus:outline-none focus:border-secondary transition-colors"
        />
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-1 left-0 w-80 max-h-72 overflow-y-auto rounded-lg border border-secondary bg-card shadow-xl z-50"
        >
          {loading ? (
            <div className="px-4 py-3 text-xs text-dim">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-dim">No results found</div>
          ) : (
            results.map((r) => (
              <button
                key={r.ticker}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-semibold text-foreground font-mono">{r.ticker}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">{r.name}</span>
                </div>
                {r.price != null && (
                  <div className="text-right">
                    <span className="text-xs text-soft font-mono">${r.price.toFixed(2)}</span>
                    {r.change1D != null && (
                      <span
                        className={cn(
                          'ml-2 text-xs font-medium',
                          r.change1D >= 0 ? 'text-positive' : 'text-negative'
                        )}
                      >
                        {r.change1D >= 0 ? '+' : ''}
                        {r.change1D.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Market Status Badge ── */
function MarketStatusBadge() {
  const { marketState } = useMarket();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <span className="text-xs text-dim whitespace-nowrap">
      Markets {marketState.status} &middot; {dateStr}, EDT
    </span>
  );
}

/* ── Main SecondaryNav ── */
export function SecondaryNav() {
  const location = useLocation();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/' && (currentPath === '/' || currentPath === '/finance')) return true;
    if (path !== '/') return currentPath === path;
    return false;
  };

  // Update indicator position when path changes
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeTab = tabsRef.current.querySelector('[data-active="true"]') as HTMLElement;
    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      });
    }
  }, [currentPath]);

  return (
    <nav className="flex items-center justify-between h-9 px-5 border-b border-border bg-background">
      {/* Tab Links */}
      <div ref={tabsRef} className="relative flex items-center gap-0 h-full">
        {NAV_TABS.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              data-active={active}
              className={cn(
                'relative flex items-center h-full px-3 text-[13px] font-normal transition-colors',
                active ? 'text-foreground' : 'text-dim hover:text-soft'
              )}
            >
              {tab.label}
            </Link>
          );
        })}

        {/* Active indicator line */}
        <div
          className="absolute bottom-0 h-[2px] bg-white rounded-full transition-all duration-200 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      </div>

      {/* Right side: Sentiment + Search + Market Status */}
      <div className="flex items-center gap-4">
        <SentimentIndicator />
        <StockSearch />
        <MarketStatusBadge />
      </div>
    </nav>
  );
}
