import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { cn } from '@/lib/utils';
import { OverviewSection } from './OverviewSection';

interface IncomeRow {
  date: string;
  period?: string;
  calendarYear?: string;
  revenue?: number;
  netIncome?: number;
}

type Period = 'annual' | 'quarter';

const REVENUE = 'hsl(213 80% 56%)';
const EARNINGS = 'hsl(38 92% 55%)';

function bn(v?: number | null): string {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return `${v}`;
}

function label(row: IncomeRow, period: Period): string {
  const yy = String(row.calendarYear ?? new Date(row.date).getFullYear()).slice(-2);
  if (period === 'annual') return `FY${yy}`;
  return `${row.period ?? ''} '${yy}`;
}

function ChartTooltip({ active, payload, periodLabel }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; revenue: number; earnings: number } }>;
  periodLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-foreground">{d.name}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: REVENUE }} /> Revenue
        </span>
        <span className="font-mono text-foreground">${bn(d.revenue)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: EARNINGS }} /> Earnings
        </span>
        <span className="font-mono text-foreground">${bn(d.earnings)}</span>
      </div>
      {periodLabel && <span className="sr-only">{periodLabel}</span>}
    </div>
  );
}

export function RevenueEarningsChart({ ticker }: { ticker: string }) {
  const [period, setPeriod] = useState<Period>('quarter');
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const limit = period === 'annual' ? 6 : 8;
        const res = await fetch(
          `${API_BASE_URL}/api/stock/${ticker}/financials/income?period=${period}&limit=${limit}`,
        );
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker, period]);

  if (!loading && rows.length === 0) return null;

  // API returns newest-first; chart reads oldest -> newest.
  const chartData = [...rows].reverse().map((r) => ({
    name: label(r, period),
    revenue: r.revenue ?? 0,
    earnings: r.netIncome ?? 0,
  }));
  const latest = chartData[chartData.length - 1];

  const toggle = (
    <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5 text-[0.7rem]">
      {(['annual', 'quarter'] as Period[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setPeriod(p)}
          className={cn(
            'rounded-full px-2.5 py-0.5 transition-colors',
            period === p ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p === 'annual' ? 'Annual' : 'Quarterly'}
        </button>
      ))}
    </div>
  );

  return (
    <OverviewSection title="Revenue vs. Earnings" right={toggle} flush>
      {loading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm italic text-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="px-3 pb-4 pt-2">
          {latest && (
            <div className="mb-2 flex items-center gap-4 px-3 text-xs">
              <span className="text-muted-foreground">{latest.name}</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: REVENUE }} />
                Revenue <span className="font-mono font-semibold text-foreground">${bn(latest.revenue)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: EARNINGS }} />
                Earnings <span className="font-mono font-semibold text-foreground">${bn(latest.earnings)}</span>
              </span>
            </div>
          )}
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }} barGap={2}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.6}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--border))"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${bn(Number(v))}`}
                  stroke="hsl(var(--border))"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }} />
                <Bar dataKey="revenue" fill={REVENUE} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="earnings" fill={EARNINGS} radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </OverviewSection>
  );
}
