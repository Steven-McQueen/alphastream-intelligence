import { cn } from '@/lib/utils';

export interface DayStripEntry {
  date: string; // YYYY-MM-DD
  count: number;
}

interface CalendarDayStripProps {
  days: DayStripEntry[];
  selected: string | null;
  onSelect: (date: string | null) => void;
}

function label(dateStr: string) {
  const d = new Date(dateStr);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    isToday: d.toDateString() === new Date().toDateString(),
  };
}

// Horizontal day selector so a specific day can be jumped to without scrolling the
// feed. "All" clears the filter. Reused across every calendar tab.
export function CalendarDayStrip({ days, selected, onSelect }: CalendarDayStripProps) {
  if (days.length === 0) return null;
  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'flex h-[58px] shrink-0 flex-col items-center justify-center rounded-xl border px-4 transition-colors',
          selected === null
            ? 'border-[var(--text-author)] bg-sidebar-accent text-foreground'
            : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
        )}
      >
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]">All</span>
        <span className="font-mono-numbers text-sm font-semibold">{days.reduce((s, d) => s + d.count, 0)}</span>
      </button>
      {days.map((d) => {
        const l = label(d.date);
        const isSel = selected === d.date;
        return (
          <button
            key={d.date}
            onClick={() => onSelect(isSel ? null : d.date)}
            className={cn(
              'flex h-[58px] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border transition-colors',
              isSel
                ? 'border-[var(--text-author)] bg-sidebar-accent text-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
              l.isToday && !isSel && 'border-[var(--text-author)]/40'
            )}
          >
            <span className="text-[0.65rem] uppercase tracking-wide text-dim">{l.weekday}</span>
            <span className="text-sm font-semibold text-foreground">
              {l.month} {l.day}
            </span>
            <span
              className={cn(
                'text-[0.7rem] font-medium',
                d.count > 0 ? 'text-[var(--text-author)]' : 'text-dim'
              )}
            >
              {d.count > 0 ? d.count : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
