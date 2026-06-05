import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { cn } from '@/lib/utils';
import { OverviewSection } from './OverviewSection';

interface Ratings {
  consensusRating?: string;
  gradesConsensus?: {
    strongBuy?: number;
    buy?: number;
    hold?: number;
    sell?: number;
    strongSell?: number;
  };
  priceTarget?: {
    targetHigh?: number;
    targetLow?: number;
    targetConsensus?: number;
  };
}

const GREEN = 'hsl(var(--primary))';
const RED = 'hsl(0 84% 60%)';
const GRAY = 'hsl(var(--muted-foreground))';

function money(v?: number | null): string {
  return v == null || isNaN(v) ? '—' : `$${Math.round(v)}`;
}

/** Position (0-100%) of a value on the low→high price-target track. */
function trackPct(v: number | null | undefined, low?: number, high?: number): number | null {
  if (v == null || low == null || high == null || high <= low) return null;
  return Math.max(0, Math.min(100, ((v - low) / (high - low)) * 100));
}

function Marker({ pct, color, hollow }: { pct: number; color: string; hollow?: boolean }) {
  return (
    <span
      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${pct}%`,
        background: hollow ? 'hsl(var(--card))' : color,
        border: `2px solid ${color}`,
      }}
    />
  );
}

export function AnalystConsensus({
  ticker,
  currentPrice,
}: {
  ticker: string;
  currentPrice?: number | null;
}) {
  const [data, setData] = useState<Ratings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/${ticker}/analyst/ratings`);
        const j = res.ok ? await res.json() : null;
        if (!cancelled) setData(j);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const gc = data?.gradesConsensus ?? {};
  const bullish = (gc.buy ?? 0) + (gc.strongBuy ?? 0);
  const neutral = gc.hold ?? 0;
  const bearish = (gc.sell ?? 0) + (gc.strongSell ?? 0);
  const total = bullish + neutral + bearish;

  if (!loading && total === 0) return null;

  const pt = data?.priceTarget ?? {};
  const { targetLow: low, targetHigh: high, targetConsensus: avg } = pt;
  const curPct = trackPct(currentPrice, low, high);
  const avgPct = trackPct(avg, low, high);

  const ratingChip = data?.consensusRating ? (
    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
      {data.consensusRating}
    </span>
  ) : null;

  return (
    <OverviewSection title="Analyst Consensus" right={ratingChip} dense>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm italic text-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4 px-4 py-3">
          {/* Distribution */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span style={{ color: RED }}>{bearish} Bearish</span>
              <span className="text-muted-foreground">{neutral} Neutral</span>
              <span style={{ color: GREEN }}>{bullish} Bullish</span>
            </div>
            <div className="flex h-2 gap-px overflow-hidden rounded-full bg-muted">
              {bearish > 0 && <div style={{ flex: bearish, background: RED }} />}
              {neutral > 0 && <div style={{ flex: neutral, background: GRAY }} />}
              {bullish > 0 && <div style={{ flex: bullish, background: GREEN }} />}
            </div>
            <div className="mt-1 text-right text-[0.7rem] text-muted-foreground">
              {total} analysts
            </div>
          </div>

          {/* Price-target track */}
          {low != null && high != null && (
            <div>
              <div className="mb-2 grid grid-cols-4 gap-1 text-xs">
                <div>
                  <div className="font-semibold text-foreground">{money(low)}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} /> Low
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">{money(currentPrice)}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full border border-muted-foreground" /> Current
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-foreground">{money(avg)}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} /> Average
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">{money(high)}</div>
                  <div className="flex items-center justify-end gap-1 text-muted-foreground">
                    High <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
                  </div>
                </div>
              </div>
              <div
                className="relative h-1.5 rounded-full"
                style={{ background: `linear-gradient(to right, ${RED}, ${GRAY}, ${GREEN})` }}
              >
                {curPct != null && <Marker pct={curPct} color={GRAY} hollow />}
                {avgPct != null && <Marker pct={avgPct} color={GREEN} />}
              </div>
            </div>
          )}
        </div>
      )}
    </OverviewSection>
  );
}
