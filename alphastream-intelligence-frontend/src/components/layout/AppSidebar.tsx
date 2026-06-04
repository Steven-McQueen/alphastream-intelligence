import { useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  Landmark,
  Calculator,
  Code2,
  Sparkles,
  Settings,
  Sun,
  Moon,
  Hexagon,
  Network,
} from 'lucide-react';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { useMarket } from '@/contexts/MarketContext';
import { useStockDetail } from '@/contexts/StockDetailContext';
import type { Stock } from '@/types';
import { API_BASE_URL } from '@/config/api';

const NAV_ITEMS = [
  { path: '/', label: 'Investing', icon: TrendingUp, disabled: false },
  { path: '#', label: 'Banking', icon: Landmark, disabled: true },
  { path: '#', label: 'Accounting', icon: Calculator, disabled: true },
  { path: '#', label: 'Develop', icon: Code2, disabled: true },
  { path: '#', label: 'Omniscience', icon: Sparkles, disabled: true },
];

export function AppSidebar() {
  const location = useLocation();
  const [isDark, setIsDark] = useState(true);
  const { watchlist } = useWatchlist();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loadingMini, setLoadingMini] = useState(false);
  const { isMarketOpen } = useMarket();
  const { openStockDetail } = useStockDetail();
  const idxRef = useRef(0);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark', !isDark);
  };

  useEffect(() => {
    const fetchStocks = async () => {
      if (!watchlist.length) {
        setStocks([]);
        return;
      }
      try {
        setLoadingMini(true);
        const params = new URLSearchParams({ tickers: watchlist.join(',') });
        const res = await fetch(`${API_BASE_URL}/api/watchlist/prices?${params.toString()}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setStocks(data);
      } catch (err) {
        console.error('Mini watchlist fetch failed', err);
      } finally {
        setLoadingMini(false);
      }
    };
    fetchStocks();
  }, [watchlist]);

  // Live staggered update: one symbol every 2s when market open
  useEffect(() => {
    if (!isMarketOpen || !watchlist.length) return;
    let cancelled = false;
    const tick = async () => {
      const symbols = watchlist;
      if (!symbols.length) return;
      const sym = symbols[idxRef.current % symbols.length];
      idxRef.current = (idxRef.current + 1) % symbols.length;
      try {
        const res = await fetch(`${API_BASE_URL}/api/live/quote?symbol=${encodeURIComponent(sym)}`);
        if (!res.ok) throw new Error('live quote failed');
        const data = await res.json();
        if (cancelled) return;
        setStocks((prev) => {
          const next = [...prev];
          const i = next.findIndex((x) => x.ticker === sym);
          if (i >= 0) {
            next[i] = {
              ...next[i],
              price: data.price ?? next[i].price,
              change1D: data.changePercent ?? next[i].change1D,
            };
          }
          return next;
        });
      } catch {
        // ignore single fetch errors
      }
    };
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isMarketOpen, watchlist]);

  const miniWatchlist = useMemo(() => {
    const filtered = stocks.filter((s) => watchlist.includes(s.ticker));
    return filtered.slice(0, 4);
  }, [stocks, watchlist]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/finance';
    return location.pathname === path;
  };

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Header / Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 text-sidebar-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent border border-border">
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">AlphaStream</span>
            <span className="text-[11px] text-dim">Finance</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-3 space-y-1">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-[0.08em] text-dim">Environments</p>
        {NAV_ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] text-dim/60 uppercase tracking-wider">Soon</span>
              </div>
            );
          }
          const active = isActive(item.path);
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mini Watchlist */}
      <div className="px-3 pt-2 pb-2">
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-[11px] uppercase tracking-[0.08em] text-dim">Watchlist</p>
          <span className="text-[11px] text-dim">Live</span>
        </div>
        <div className="space-y-2 rounded-xl border border-border bg-sidebar-accent p-2">
          {loadingMini && miniWatchlist.length === 0 && (
            <div className="text-xs text-dim px-2 py-2">Loading watchlist...</div>
          )}
          {!loadingMini && miniWatchlist.length === 0 && (
            <div className="text-xs text-dim px-2 py-2">No watchlist stocks yet</div>
          )}
          {miniWatchlist.map((item) => (
            <button
              key={item.ticker}
              onClick={() => openStockDetail(item)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted transition-all duration-200 text-left"
            >
              <div className="flex flex-col w-16">
                <span className="text-xs font-semibold text-sidebar-foreground">{item.ticker}</span>
                <span className="text-[11px] text-dim">
                  ${typeof item.price === 'number' ? item.price.toFixed(2) : '—'}
                </span>
              </div>
              <div
                className={cn(
                  'ml-auto text-xs font-medium',
                  (item.change1D ?? 0) >= 0 ? 'text-positive' : 'text-negative'
                )}
              >
                {(item.change1D ?? 0) >= 0 ? '+' : ''}
                {(item.change1D ?? 0).toFixed(2)}%
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-sidebar-border px-3 py-3 space-y-2">
        <Link
          to="/atlas"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100',
            isActive('/atlas')
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-sidebar-foreground'
          )}
        >
          <Network className="h-4 w-4" />
          <span>Atlas</span>
        </Link>

        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-100',
            isActive('/settings')
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-sidebar-foreground'
                )}
              >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
            </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-100 hover:bg-muted hover:text-sidebar-foreground"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
}
