import { useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Brain,
  LineChart,
  List,
  Briefcase,
  Sliders,
  GitCompare,
  Settings,
  Sun,
  Moon,
  Hexagon,
  Star,
} from 'lucide-react';
import { useWatchlist } from '@/contexts/WatchlistContext';
import type { Stock } from '@/types';

const API_BASE_URL = 'http://localhost:8000';

const NAV_ITEMS = [
  { path: '/intelligence', label: 'Intelligence', icon: Brain },
  { path: '/market', label: 'Market', icon: LineChart },
  { path: '/screener', label: 'Screener', icon: List },
  { path: '/watchlist', label: 'Watchlist', icon: Star },
  { path: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { path: '/optimizer', label: 'Optimizer', icon: Sliders },
  { path: '/simulation', label: 'Simulation', icon: GitCompare },
];

export function AppSidebar() {
  const location = useLocation();
  const [isDark, setIsDark] = useState(true);
  const { watchlist } = useWatchlist();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loadingMini, setLoadingMini] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark', !isDark);
  };

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        setLoadingMini(true);
        const res = await fetch(`${API_BASE_URL}/api/universe/core`);
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
  }, []);

  const miniWatchlist = useMemo(() => {
    const filtered = stocks.filter((s) => watchlist.includes(s.ticker));
    return filtered.slice(0, 4);
  }, [stocks, watchlist]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-zinc-800/60 bg-[#0f0f11] text-zinc-200">
      {/* Header / Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-zinc-800/60">
        <Link to="/" className="flex items-center gap-2 text-zinc-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800">
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">AlphaStream</span>
            <span className="text-[11px] text-zinc-500">Finance</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-3 space-y-1">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">Navigation</p>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
                    className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-300 hover:bg-zinc-900/70 hover:text-zinc-50'
                    )}
                  >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
                </Link>
          );
        })}
      </nav>

      {/* Mini Watchlist */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Watchlist</p>
          <span className="text-[11px] text-zinc-500">Live</span>
        </div>
        <div className="space-y-2 rounded-xl border border-zinc-800/60 bg-[#101014] p-2">
          {loadingMini && miniWatchlist.length === 0 && (
            <div className="text-xs text-zinc-500 px-2 py-2">Loading watchlist...</div>
          )}
          {!loadingMini && miniWatchlist.length === 0 && (
            <div className="text-xs text-zinc-500 px-2 py-2">No watchlist stocks yet</div>
          )}
          {miniWatchlist.map((item) => (
            <Link
              key={item.ticker}
              to="/watchlist"
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-900/60 transition-colors"
            >
              <div className="flex flex-col w-16">
                <span className="text-xs font-semibold text-zinc-100">{item.ticker}</span>
                <span className="text-[11px] text-zinc-500">
                  ${typeof item.price === 'number' ? item.price.toFixed(2) : '—'}
                </span>
              </div>
              <div
                className={cn(
                  'ml-auto text-xs font-medium',
                  (item.change1D ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {(item.change1D ?? 0) >= 0 ? '+' : ''}
                {(item.change1D ?? 0).toFixed(2)}%
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-zinc-800/60 px-3 py-3 space-y-2">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive('/settings')
              ? 'bg-zinc-800 text-zinc-50'
              : 'text-zinc-300 hover:bg-zinc-900/70 hover:text-zinc-50'
                )}
              >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
            </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900/70 hover:text-zinc-50"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
}
