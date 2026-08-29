import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { cn } from '@/lib/utils';
import { OverviewSection } from './OverviewSection';

interface InsiderTrade {
  date: string;
  name: string | null;
  position: string | null;
  type: 'Buy' | 'Sell' | 'Other';
  shares: number | null;
  price: number | null;
  value: number | null;
}

function fmtValue(v: number | null): string {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtShares(v: number | null): string {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return v.toLocaleString();
}

export function InsiderTrades({ ticker }: { ticker: string }) {
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/insider-trades`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setTrades(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching insider trades:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Hide entirely if there is no activity to show.
  if (!loading && trades.length === 0) return null;

  const buys = trades.filter((t) => t.type === 'Buy').length;
  const sells = trades.filter((t) => t.type === 'Sell').length;

  const countChip = !loading ? (
    <span className="text-xs text-dim">
      <span className="text-positive">{buys} buys</span>
      <span className="px-1.5 text-dim">·</span>
      <span className="text-negative">{sells} sells</span>
    </span>
  ) : null;

  return (
    <OverviewSection title="Insider Activity" kicker="Execs & 10% Owners" right={countChip} flush>
      {loading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm italic text-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading insider trades...
        </div>
      ) : (
        <div className="px-3 pb-2">
          {/* Column header */}
          <div className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] items-center gap-x-4 border-b border-border px-3 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-dim">
            <span>Insider</span>
            <span className="text-right">Shares</span>
            <span className="text-right">Value</span>
          </div>

          {trades.map((t, i) => (
            <div
              key={`${t.name}-${t.date}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] items-center gap-x-4 border-b border-border/40 px-3 py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide',
                      t.type === 'Buy'
                        ? 'bg-positive/15 text-positive'
                        : t.type === 'Sell'
                          ? 'bg-negative/15 text-negative'
                          : 'bg-muted text-dim',
                    )}
                  >
                    {t.type}
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {t.name || '—'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {t.position || 'Insider'}
                  <span className="px-1.5 text-dim">·</span>
                  {t.date || '—'}
                </div>
              </div>
              <span className="font-mono-numbers text-right text-sm tabular-nums text-soft">
                {fmtShares(t.shares)}
              </span>
              <span
                className={cn(
                  'font-mono-numbers text-right text-sm tabular-nums',
                  t.type === 'Buy' ? 'text-positive' : t.type === 'Sell' ? 'text-negative' : 'text-foreground',
                )}
              >
                {fmtValue(t.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </OverviewSection>
  );
}
