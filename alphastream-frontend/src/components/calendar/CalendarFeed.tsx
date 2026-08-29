import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, Loader2, CalendarDays, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { API_BASE_URL } from '@/config/api';
import { CalendarDayStrip, type DayStripEntry } from './CalendarDayStrip';

const RANGE_DAYS = 30;

export interface CalendarRow {
  symbol: string;
  date: string;
  company_name?: string;
  [key: string]: unknown;
}

export interface CalendarColumn<T> {
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
  className?: string;
}

interface CalendarFeedProps<T extends CalendarRow> {
  /** Backend path, e.g. "/api/calendar/ipos" or "/api/earnings/calendar". */
  endpoint: string;
  columns: CalendarColumn<T>[];
  stats?: (rows: T[]) => { label: string; value: string }[];
  searchPlaceholder?: string;
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
  /** When provided, clicking a row toggles an expanded panel instead of onRowClick. */
  renderExpanded?: (row: T) => ReactNode;
}

function dayKey(d: Date) {
  return d.toISOString().split('T')[0];
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function formatDayHeading(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function formatRangeLabel(start: Date, end: Date) {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', o)} – ${end.toLocaleDateString('en-US', o)}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-sidebar-accent rounded-xl border border-border p-4">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-sub">{label}</div>
      <div className="mt-1.5 font-mono-numbers text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function CalendarFeed<T extends CalendarRow>({
  endpoint,
  columns,
  stats,
  searchPlaceholder = 'Search company or ticker...',
  emptyLabel = 'No entries found in this period',
  onRowClick,
  renderExpanded,
}: CalendarFeedProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rangeOffset, setRangeOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const windowStart = useMemo(() => addDays(new Date(), rangeOffset), [rangeOffset]);
  const windowEnd = useMemo(() => addDays(windowStart, RANGE_DAYS), [windowStart]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelectedDate(null);
        setExpandedKey(null);
        const url = `${API_BASE_URL}${endpoint}?from_date=${dayKey(windowStart)}&to_date=${dayKey(windowEnd)}&limit=500`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(`Failed to fetch ${endpoint}:`, err);
        setError('Unable to load this calendar. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [endpoint, windowStart, windowEnd]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.symbol.toLowerCase().includes(q) || (r.company_name ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map: Record<string, T[]> = {};
    filtered.forEach((r) => {
      if (!r.date) return;
      (map[r.date] ||= []).push(r);
    });
    return Object.keys(map)
      .sort()
      .map((date) => ({ date, items: map[date] }));
  }, [filtered]);

  const dayEntries: DayStripEntry[] = useMemo(
    () => grouped.map((g) => ({ date: g.date, count: g.items.length })),
    [grouped]
  );

  const visibleGroups = selectedDate ? grouped.filter((g) => g.date === selectedDate) : grouped;

  const statCards = stats ? stats(rows) : [];
  const isCurrentWindow = rangeOffset === 0;

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 border-border bg-card pl-9 text-foreground placeholder:text-dim"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* KPI cards */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}

      {/* Day strip */}
      {!loading && !error && dayEntries.length > 0 && (
        <CalendarDayStrip days={dayEntries} selected={selectedDate} onSelect={setSelectedDate} />
      )}

      {/* Window nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-dim">{formatRangeLabel(windowStart, windowEnd)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRangeOffset((o) => o - RANGE_DAYS)}
            className="rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRangeOffset(0)}
            disabled={isCurrentWindow}
            className={cn(
              'rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-muted hover:text-foreground',
              isCurrentWindow ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            Today
          </button>
          <button
            onClick={() => setRangeOffset((o) => o + RANGE_DAYS)}
            className="rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-dim">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center text-negative">{error}</div>
      ) : visibleGroups.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-dim">
          <CalendarDays className="h-8 w-8 opacity-40" />
          {search ? `No matches for "${search}"` : emptyLabel}
        </div>
      ) : (
        <div className="space-y-8">
          {visibleGroups.map((group) => (
            <section key={group.date} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
                <h3
                  className="text-lg font-semibold text-foreground"
                  style={{ fontFamily: 'var(--font-page-heading)' }}
                >
                  {formatDayHeading(group.date)}
                </h3>
                <span className="text-xs text-dim">
                  {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/40">
                    <tr className="text-xs text-dim">
                      {columns.map((c) => (
                        <th
                          key={c.header}
                          className={cn('px-4 py-2 font-medium', c.align === 'right' ? 'text-right' : 'text-left')}
                        >
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((row, idx) => {
                      const key = `${row.symbol}-${row.date}-${idx}`;
                      const expandable = !!renderExpanded;
                      const isExpanded = expandedKey === key;
                      return (
                        <Fragment key={key}>
                          <tr
                            onClick={() => {
                              if (expandable) setExpandedKey(isExpanded ? null : key);
                              else onRowClick?.(row);
                            }}
                            className={cn(
                              'border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30',
                              (onRowClick || expandable) && 'cursor-pointer'
                            )}
                          >
                            {columns.map((c) => (
                              <td
                                key={c.header}
                                className={cn(
                                  'px-4 py-3',
                                  c.align === 'right' ? 'text-right' : 'text-left',
                                  c.className
                                )}
                              >
                                {c.render(row)}
                              </td>
                            ))}
                          </tr>
                          {expandable && isExpanded && (
                            <tr className="border-b border-border/50 bg-muted/20">
                              <td colSpan={columns.length} className="px-4 py-3">
                                {renderExpanded!(row)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
