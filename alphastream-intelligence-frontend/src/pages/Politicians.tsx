import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, ExternalLink, Search, X, Users, ArrowLeftRight } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { Stock } from '@/types';
import { useStockDetail } from '@/contexts/StockDetailContext';

interface CongressTrade {
  firstName: string;
  lastName: string;
  symbol: string;
  type: string;
  amount: string;
  transactionDate: string;
  disclosureDate: string;
  district?: string;
  office?: string;
  assetDescription?: string;
  link?: string;
}

function isBuyTrade(type: string | undefined): boolean {
  const t = type?.toLowerCase() ?? '';
  return t.includes('purchase') || t.includes('buy');
}

// A ticker-ish query: 1-5 letters, optionally with a dot/hyphen suffix.
function looksLikeTicker(query: string): boolean {
  return /^[A-Za-z]{1,5}([.-][A-Za-z]{1,3})?$/.test(query.trim());
}

// KPI summary card - tokens only, no hardcoded colors/fonts.
function StatCard({ label, value, accent }: { label: string; value: string; accent?: 'positive' | 'negative' }) {
  return (
    <div className="bg-sidebar-accent rounded-xl border border-border p-4">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-sub">{label}</div>
      <div
        className={cn(
          'mt-1.5 font-mono-numbers text-2xl font-semibold',
          accent === 'positive' ? 'text-positive' : accent === 'negative' ? 'text-negative' : 'text-foreground'
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function Politicians() {
  const { openStockDetail } = useStockDetail();

  const [trades, setTrades] = useState<CongressTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');

  // Server-side ticker lookup (full Congress history for one symbol).
  const [tickerResults, setTickerResults] = useState<CongressTrade[] | null>(null);
  const [tickerSymbol, setTickerSymbol] = useState('');
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tickerError, setTickerError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/congress/trades/recent?limit=100`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        setTrades(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch congress trades:', err);
        setError('Unable to load congressional trades. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrades();
  }, []);

  // Client-side filter of the loaded recent trades by politician name or symbol.
  const filteredTrades = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter((t) => {
      const name = `${t.firstName ?? ''} ${t.lastName ?? ''}`.toLowerCase();
      return name.includes(q) || (t.symbol ?? '').toLowerCase().includes(q);
    });
  }, [trades, query]);

  // The rows actually rendered: server ticker results take precedence when active.
  const displayTrades = tickerResults ?? filteredTrades;

  // Stats reflect what is currently displayed.
  const stats = useMemo(() => {
    const buys = displayTrades.filter((t) => isBuyTrade(t.type)).length;
    const politicians = new Set(displayTrades.map((t) => `${t.firstName} ${t.lastName}`)).size;
    return { total: displayTrades.length, buys, sells: displayTrades.length - buys, politicians };
  }, [displayTrades]);

  // Offer a server ticker search when the query looks like a symbol and isn't
  // already showing server results.
  const showTickerSearchPrompt = !tickerResults && looksLikeTicker(query);

  const searchTicker = async () => {
    const symbol = query.trim().toUpperCase();
    if (!symbol) return;
    try {
      setTickerLoading(true);
      setTickerError(null);
      const res = await fetch(`${API_BASE_URL}/api/congress/trades/${symbol}?limit=100`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setTickerResults(Array.isArray(data) ? data : []);
      setTickerSymbol(symbol);
    } catch (err) {
      console.error('Failed to fetch ticker trades:', err);
      setTickerError(`Unable to load trades for ${symbol}.`);
    } finally {
      setTickerLoading(false);
    }
  };

  const clearTickerSearch = () => {
    setTickerResults(null);
    setTickerSymbol('');
    setTickerError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-5 py-6">
        {/* Masthead */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <h1
                className="text-[34px] font-semibold leading-none text-foreground"
                style={{ fontFamily: 'var(--font-page-heading)' }}
              >
                Congressional Trading
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Recent stock transactions disclosed by members of the U.S. Senate and House
              </p>
            </div>
            {/* Search */}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              <Input
                placeholder="Search politician or ticker..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (tickerResults) clearTickerSearch();
                }}
                className="h-9 border-border bg-card pl-9 text-foreground placeholder:text-dim"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    clearTickerSearch();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Trades Shown" value={String(stats.total)} />
          <StatCard label="Purchases" value={String(stats.buys)} accent="positive" />
          <StatCard label="Sales" value={String(stats.sells)} accent="negative" />
          <StatCard label="Politicians" value={String(stats.politicians)} />
        </div>

        {/* Ticker search context bar */}
        {tickerResults ? (
          <div className="flex items-center justify-between rounded-xl border border-border bg-sidebar-accent px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <ArrowLeftRight className="h-4 w-4 text-[var(--text-author)]" />
              Showing all Congress trades for <span className="font-mono font-semibold">{tickerSymbol}</span>
            </div>
            <button
              onClick={clearTickerSearch}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Back to recent trades
            </button>
          </div>
        ) : showTickerSearchPrompt ? (
          <button
            onClick={searchTicker}
            disabled={tickerLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-sidebar-accent px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {tickerLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search full Congress history for{' '}
            <span className="font-mono font-semibold text-foreground">{query.trim().toUpperCase()}</span>
          </button>
        ) : null}

        {tickerError && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-negative">{tickerError}</div>
        )}

        {/* Trades table */}
        {loading ? (
          <div className="flex h-64 items-center justify-center text-dim">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading congressional trades...
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-1 text-dim">
            <span className="text-negative">{error}</span>
          </div>
        ) : displayTrades.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-dim">
            <Users className="h-8 w-8 opacity-40" />
            {query ? `No trades match "${query}"` : 'No recent trades available'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-card">
                  <tr className="text-xs text-dim">
                    <th className="px-4 py-3 text-left font-medium">Politician</th>
                    <th className="px-4 py-3 text-left font-medium">Symbol</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Transaction</th>
                    <th className="px-4 py-3 text-left font-medium">Disclosed</th>
                    <th className="px-4 py-3 text-left font-medium">Delay</th>
                    <th className="px-4 py-3 text-right font-medium">Filing</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTrades.map((trade, idx) => {
                    const isBuy = isBuyTrade(trade.type);
                    const delayDays =
                      trade.disclosureDate && trade.transactionDate
                        ? Math.floor(
                            (new Date(trade.disclosureDate).getTime() -
                              new Date(trade.transactionDate).getTime()) /
                              (1000 * 60 * 60 * 24)
                          )
                        : null;

                    return (
                      <tr
                        key={`${trade.symbol}-${trade.disclosureDate}-${idx}`}
                        onClick={() =>
                          trade.symbol &&
                          openStockDetail({ ticker: trade.symbol, name: trade.assetDescription || trade.symbol } as unknown as Stock)
                        }
                        className="cursor-pointer border-b border-border transition-colors hover:bg-card/50"
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-foreground">
                            {trade.firstName} {trade.lastName}
                          </div>
                          <div className="text-xs text-dim">{trade.district || trade.office}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-foreground">{trade.symbol}</div>
                          <div className="max-w-[120px] truncate text-xs text-dim">
                            {trade.assetDescription}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                              isBuy ? 'bg-positive/20 text-positive' : 'bg-negative/20 text-negative'
                            )}
                          >
                            {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {trade.type?.replace('(Full)', '').replace('(Partial)', '').trim()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-soft">{trade.amount || '-'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{trade.transactionDate || '-'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{trade.disclosureDate || '-'}</td>
                        <td className="px-4 py-3">
                          {delayDays !== null && delayDays > 0 && (
                            <span
                              className={cn(
                                'rounded-full px-2 py-1 text-xs',
                                delayDays > 30
                                  ? 'bg-negative/20 text-negative'
                                  : delayDays > 14
                                    ? 'bg-warning/20 text-warning'
                                    : 'bg-secondary text-muted-foreground'
                              )}
                            >
                              +{delayDays}d
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {trade.link && (
                            <a
                              href={trade.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[var(--accent-blue-text)] hover:opacity-80"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
