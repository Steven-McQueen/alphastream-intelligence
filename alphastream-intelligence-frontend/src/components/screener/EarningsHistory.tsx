import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { cn } from '@/lib/utils';
import { OverviewSection } from './OverviewSection';
import { EarningsChart } from './EarningsChart';

interface Earning {
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  surprise: number | null;
}

// Surprise % relative to the estimate.
function surprisePct(e: Earning): number | null {
  if (e.epsActual == null || e.epsEstimated == null || e.epsEstimated === 0) return null;
  return ((e.epsActual - e.epsEstimated) / Math.abs(e.epsEstimated)) * 100;
}

export function EarningsHistory({ ticker }: { ticker: string }) {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/earnings/${ticker}?limit=6`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setEarnings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching earnings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Only the quarters that have a reported (actual) result.
  const reported = earnings.filter((e) => e.epsActual != null);
  if (!loading && reported.length === 0) return null;

  // Most recent reported quarter drives the header beat/miss chip.
  const latest = reported[0];
  const latestPct = latest ? surprisePct(latest) : null;
  const beat = latestPct != null && latestPct >= 0;

  const headerChip =
    !loading && latestPct != null ? (
      <span
        className={cn(
          'rounded-md px-2 py-0.5 text-xs font-semibold',
          beat ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative',
        )}
      >
        {beat ? 'Beat' : 'Miss'} {latestPct >= 0 ? '+' : ''}
        {latestPct.toFixed(1)}%
      </span>
    ) : null;

  return (
    <OverviewSection title="Earnings" kicker="Estimates vs Actual" right={headerChip} flush>
      {loading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm italic text-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading earnings...
        </div>
      ) : (
        <EarningsChart data={reported} />
      )}
    </OverviewSection>
  );
}
