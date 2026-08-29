import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface EarningPoint {
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
}

const GREEN = 'hsl(var(--primary))';
const RED = 'hsl(0 84% 60%)';

function fmtQuarter(date: string): string {
  // FMP earnings dates are ISO (YYYY-MM-DD); derive a fiscal-ish quarter label.
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} '${String(d.getFullYear()).slice(2)}`;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { estimate: number | null; actual: number | null; beat: boolean };
}

function EstimateDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || payload?.estimate == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill="hsl(var(--card))"
      stroke="hsl(var(--muted-foreground))"
      strokeWidth={1.75}
    />
  );
}

function ActualDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || payload?.actual == null) return null;
  return <circle cx={cx} cy={cy} r={7} fill={payload.beat ? GREEN : RED} />;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-foreground">{d.quarter}</div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Estimate</span>
        <span className="font-mono">{d.estimate == null ? '—' : `$${d.estimate.toFixed(2)}`}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Actual</span>
        <span className="font-mono font-semibold" style={{ color: d.beat ? GREEN : RED }}>
          {d.actual == null ? '—' : `$${d.actual.toFixed(2)}`}
        </span>
      </div>
    </div>
  );
}

interface ChartDatum {
  quarter: string;
  estimate: number | null;
  actual: number | null;
  beat: boolean;
}

export function EarningsChart({ data }: { data: EarningPoint[] }) {
  // API returns newest-first; chart reads oldest -> newest, left to right.
  const chartData: ChartDatum[] = [...data]
    .reverse()
    .map((e) => ({
      quarter: fmtQuarter(e.date),
      estimate: e.epsEstimated,
      actual: e.epsActual,
      beat: e.epsActual != null && e.epsEstimated != null && e.epsActual >= e.epsEstimated,
    }));

  return (
    <div className="px-3 pb-4 pt-2">
      {/* Legend */}
      <div className="mb-2 flex items-center gap-4 px-3 text-[0.7rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-[1.75px] border-muted-foreground bg-card" /> Estimate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: GREEN }} /> Beat
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: RED }} /> Miss
        </span>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.6}
              vertical={false}
            />
            <XAxis
              dataKey="quarter"
              stroke="hsl(var(--border))"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              stroke="hsl(var(--border))"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
            <Line
              dataKey="estimate"
              stroke="none"
              dot={<EstimateDot />}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              dataKey="actual"
              stroke="none"
              dot={<ActualDot />}
              isAnimationActive={false}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
