import { useState } from 'react';
import type { Stock } from '@/types';
import { cn } from '@/lib/utils';
import { useStockDetail } from '@/contexts/StockDetailContext';
import { EarningsSpotlight } from '@/components/finance/EarningsSpotlight';
import { CalendarFeed, type CalendarColumn, type CalendarRow } from '@/components/calendar/CalendarFeed';
import { IpoDetail } from '@/components/calendar/IpoDetail';

type Tab = 'earnings' | 'ipos' | 'dividends' | 'splits';

const TABS: { id: Tab; label: string }[] = [
  { id: 'earnings', label: 'Earnings' },
  { id: 'ipos', label: 'IPOs' },
  { id: 'dividends', label: 'Dividends' },
  { id: 'splits', label: 'Splits' },
];

// ---- formatting helpers ---------------------------------------------------
function fmtEps(v: unknown) {
  return typeof v === 'number' ? `$${v.toFixed(2)}` : '-';
}
function fmtMoney(v: unknown) {
  if (typeof v !== 'number') return '-';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}
function fmtShares(v: unknown) {
  if (typeof v !== 'number') return '-';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}
function fmtYield(v: unknown) {
  return typeof v === 'number' ? `${v.toFixed(2)}%` : '-';
}
function fmtDividend(v: unknown) {
  return typeof v === 'number' ? `$${v.toFixed(4)}` : '-';
}
function todayKey() {
  return new Date().toISOString().split('T')[0];
}
function weekCutoffKey() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// ---- row types ------------------------------------------------------------
interface EarningsRow extends CalendarRow {
  eps_estimated: number | null;
  revenue_estimated: number | null;
}
interface IpoRow extends CalendarRow {
  exchange?: string;
  actions?: string;
  shares?: number;
  price_range?: string;
  market_cap?: number;
}
interface DividendRow extends CalendarRow {
  payment_date?: string;
  dividend?: number;
  yield?: number;
  frequency?: string;
}
interface SplitRow extends CalendarRow {
  numerator?: number;
  denominator?: number;
  split_type?: string;
}

const symbolCell = (r: CalendarRow) => (
  <span className="font-mono font-semibold text-foreground">{r.symbol}</span>
);
const companyCell = (r: CalendarRow) => (
  <span className="text-sm text-muted-foreground">{r.company_name}</span>
);

export default function Earnings() {
  const { openStockDetail } = useStockDetail();
  const [tab, setTab] = useState<Tab>('earnings');

  const openStock = (r: CalendarRow) =>
    openStockDetail({ ticker: r.symbol, name: r.company_name || r.symbol } as unknown as Stock);

  // ---- per-tab column configs ----
  const earningsColumns: CalendarColumn<EarningsRow>[] = [
    { header: 'Symbol', render: symbolCell },
    { header: 'Company', render: companyCell, className: 'max-w-[280px] truncate' },
    { header: 'Est. EPS', align: 'right', render: (r) => <span className="font-mono text-sm text-soft">{fmtEps(r.eps_estimated)}</span> },
    { header: 'Est. Revenue', align: 'right', render: (r) => <span className="font-mono text-sm text-soft">{fmtMoney(r.revenue_estimated)}</span> },
  ];

  const ipoColumns: CalendarColumn<IpoRow>[] = [
    { header: 'Symbol', render: symbolCell },
    { header: 'Company', render: companyCell, className: 'max-w-[240px] truncate' },
    { header: 'Exchange', render: (r) => <span className="text-sm text-muted-foreground">{r.exchange || '-'}</span> },
    { header: 'Price Range', render: (r) => <span className="font-mono text-sm text-soft">{r.price_range || '-'}</span> },
    { header: 'Shares', align: 'right', render: (r) => <span className="font-mono text-sm text-soft">{fmtShares(r.shares)}</span> },
    { header: 'Market Cap', align: 'right', render: (r) => <span className="font-mono text-sm text-soft">{fmtMoney(r.market_cap)}</span> },
    {
      header: 'Status',
      render: (r) => (
        <span className="rounded-full bg-muted px-2 py-1 text-xs text-sub">{r.actions || '-'}</span>
      ),
    },
  ];

  const dividendColumns: CalendarColumn<DividendRow>[] = [
    { header: 'Symbol', render: symbolCell },
    { header: 'Company', render: companyCell, className: 'max-w-[240px] truncate' },
    { header: 'Ex-Date', render: (r) => <span className="text-sm text-muted-foreground">{r.date}</span> },
    { header: 'Pay Date', render: (r) => <span className="text-sm text-muted-foreground">{r.payment_date || '-'}</span> },
    { header: 'Dividend', align: 'right', render: (r) => <span className="font-mono text-sm text-soft">{fmtDividend(r.dividend)}</span> },
    { header: 'Yield', align: 'right', render: (r) => <span className="font-mono text-sm text-positive">{fmtYield(r.yield)}</span> },
    { header: 'Frequency', render: (r) => <span className="text-xs text-sub">{r.frequency || '-'}</span> },
  ];

  const splitColumns: CalendarColumn<SplitRow>[] = [
    { header: 'Symbol', render: symbolCell },
    { header: 'Company', render: companyCell, className: 'max-w-[280px] truncate' },
    {
      header: 'Ratio',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">
          {r.numerator ?? '?'}:{r.denominator ?? '?'}
        </span>
      ),
    },
    {
      header: 'Type',
      render: (r) => {
        const fwd = (r.numerator ?? 0) >= (r.denominator ?? 0);
        return (
          <span className={cn('rounded-full px-2 py-1 text-xs', fwd ? 'bg-positive/20 text-positive' : 'bg-negative/20 text-negative')}>
            {fwd ? 'Forward' : 'Reverse'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-5 py-6">
        {/* Masthead */}
        <header className="space-y-4">
          <div className="border-b border-border pb-4">
            <h1
              className="text-[34px] font-semibold leading-none text-foreground"
              style={{ fontFamily: 'var(--font-page-heading)' }}
            >
              Markets Calendar
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Earnings, IPOs, dividends and stock splits — grouped by day
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                  tab === t.id
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {tab === 'earnings' && (
          <>
            <EarningsSpotlight />
            <CalendarFeed<EarningsRow>
              endpoint="/api/earnings/calendar"
              columns={earningsColumns}
              onRowClick={openStock}
              emptyLabel="No earnings found in this period"
              searchPlaceholder="Search company or ticker..."
              stats={(rows) => {
                const tk = todayKey();
                const wk = weekCutoffKey();
                return [
                  { label: 'Reports In View', value: String(rows.length) },
                  { label: 'This Week', value: String(rows.filter((r) => r.date >= tk && r.date <= wk).length) },
                  { label: 'Reporting Today', value: String(rows.filter((r) => r.date === tk).length) },
                  { label: 'Companies', value: String(new Set(rows.map((r) => r.symbol)).size) },
                ];
              }}
            />
          </>
        )}

        {tab === 'ipos' && (
          <CalendarFeed<IpoRow>
            endpoint="/api/calendar/ipos"
            columns={ipoColumns}
            renderExpanded={(r) => <IpoDetail symbol={r.symbol} />}
            emptyLabel="No IPOs found in this period"
            searchPlaceholder="Search company or ticker..."
            stats={(rows) => {
              const priced = rows.filter((r) => (r.actions || '').toLowerCase().includes('priced')).length;
              return [
                { label: 'IPOs In View', value: String(rows.length) },
                { label: 'Priced', value: String(priced) },
                { label: 'Expected', value: String(rows.length - priced) },
                { label: 'Exchanges', value: String(new Set(rows.map((r) => r.exchange).filter(Boolean)).size) },
              ];
            }}
          />
        )}

        {tab === 'dividends' && (
          <CalendarFeed<DividendRow>
            endpoint="/api/calendar/dividends"
            columns={dividendColumns}
            onRowClick={openStock}
            emptyLabel="No dividends found in this period"
            searchPlaceholder="Search company or ticker..."
            stats={(rows) => {
              const yields = rows.map((r) => r.yield).filter((y): y is number => typeof y === 'number' && y > 0);
              const avg = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : 0;
              const tk = todayKey();
              const wk = weekCutoffKey();
              return [
                { label: 'Ex-Dates In View', value: String(rows.length) },
                { label: 'Avg Yield', value: `${avg.toFixed(2)}%` },
                { label: 'This Week', value: String(rows.filter((r) => r.date >= tk && r.date <= wk).length) },
                { label: 'Companies', value: String(new Set(rows.map((r) => r.symbol)).size) },
              ];
            }}
          />
        )}

        {tab === 'splits' && (
          <CalendarFeed<SplitRow>
            endpoint="/api/calendar/splits"
            columns={splitColumns}
            onRowClick={openStock}
            emptyLabel="No splits found in this period"
            searchPlaceholder="Search company or ticker..."
            stats={(rows) => {
              const fwd = rows.filter((r) => (r.numerator ?? 0) >= (r.denominator ?? 0)).length;
              return [
                { label: 'Splits In View', value: String(rows.length) },
                { label: 'Forward', value: String(fwd) },
                { label: 'Reverse', value: String(rows.length - fwd) },
                { label: 'Companies', value: String(new Set(rows.map((r) => r.symbol)).size) },
              ];
            }}
          />
        )}
      </div>
    </div>
  );
}
