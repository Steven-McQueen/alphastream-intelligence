import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { useStockDetail } from '@/contexts/StockDetailContext';
import type { Stock } from '@/types';
import { cn } from '@/lib/utils';
import { OverviewSection } from './OverviewSection';

interface Peer {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
}

function fmtCap(v: number | null): string {
  if (v === null || v === undefined) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtChg(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

// Shared grid template keeps the header labels and every row column perfectly aligned.
const ROW_GRID =
  'grid grid-cols-[1.75rem_minmax(0,1fr)_6rem_5.5rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_6rem_7rem] items-center gap-x-4';

export function SimilarCompanies({ ticker, compact = false }: { ticker: string; compact?: boolean }) {
  const { openStockDetail } = useStockDetail();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/peers`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setPeers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching peers:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Hide the section entirely if there are no peers.
  if (!loading && peers.length === 0) return null;

  const open = (p: Peer) =>
    openStockDetail({ ticker: p.symbol, name: p.name } as unknown as Stock);

  // ── Compact variant: dense rows for the narrow right rail ──
  if (compact) {
    return (
      <OverviewSection title="Similar Companies" kicker="Peers" dense flush>
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-5 text-sm italic text-dim">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="px-2 pb-1">
            {peers.map((p) => {
              const up = (p.changePercent ?? 0) >= 0;
              return (
                <button
                  key={p.symbol}
                  onClick={() => open(p)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border/40 px-2 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="font-mono-numbers text-sm font-semibold text-foreground">{p.symbol}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-numbers text-sm tabular-nums text-foreground">
                      {p.price != null ? `$${p.price.toFixed(2)}` : '—'}
                    </div>
                    <div
                      className={cn(
                        'font-mono-numbers text-xs tabular-nums',
                        up ? 'text-positive' : 'text-negative',
                      )}
                    >
                      {fmtChg(p.changePercent)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </OverviewSection>
    );
  }

  // ── Full variant: aligned table for the wide main column ──
  const headerRight = <span className="hidden text-xs text-dim sm:block">Click any name to compare</span>;

  return (
    <OverviewSection title="Similar Companies" kicker="Industry Peers" right={headerRight} flush>
      {loading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm italic text-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading peers...
        </div>
      ) : (
        <div className="px-3 pb-2">
          {/* Column header row */}
          <div
            className={cn(
              ROW_GRID,
              'border-b border-border px-3 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-dim',
            )}
          >
            <span className="text-right">#</span>
            <span>Company</span>
            <span className="text-right">Last</span>
            <span className="text-right">Chg</span>
            <span className="hidden text-right sm:block">Mkt Cap</span>
          </div>

          {/* Peer rows */}
          {peers.map((p, idx) => {
            const up = (p.changePercent ?? 0) >= 0;
            return (
              <button
                key={p.symbol}
                onClick={() => open(p)}
                className={cn(
                  ROW_GRID,
                  'w-full border-b border-border/40 px-3 py-3 text-left transition-colors last:border-0 hover:bg-muted/40',
                )}
              >
                <span className="font-mono-numbers text-right text-sm tabular-nums text-dim">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="font-mono-numbers text-sm font-semibold tracking-wide text-foreground">
                    {p.symbol}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{p.name}</div>
                </div>
                <div className="font-mono-numbers text-right text-sm tabular-nums text-foreground">
                  {p.price != null ? `$${p.price.toFixed(2)}` : '—'}
                </div>
                <div
                  className={cn(
                    'font-mono-numbers text-right text-sm tabular-nums',
                    up ? 'text-positive' : 'text-negative',
                  )}
                >
                  {fmtChg(p.changePercent)}
                </div>
                <div className="hidden text-right sm:block">
                  <span className="font-mono-numbers text-sm tabular-nums text-soft">
                    {fmtCap(p.marketCap)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </OverviewSection>
  );
}
