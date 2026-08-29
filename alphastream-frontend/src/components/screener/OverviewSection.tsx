import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OverviewSectionProps {
  title: ReactNode;
  /** Optional muted sub-label shown next to the title. */
  kicker?: string;
  /** Optional content rendered on the right side of the header (badges, counts). */
  right?: ReactNode;
  /** Remove inner body padding when the child manages its own (e.g. tables). */
  flush?: boolean;
  /** Tighter chrome for use inside the narrow right rail. */
  dense?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Shared card chrome for the stock-sheet sections.
 * Deliberately neutral/robust (terminal-style): plain bold sans heading on a
 * bordered card, no accent colors or serif. Colors/fonts come from index.css tokens.
 */
export function OverviewSection({
  title,
  kicker,
  right,
  flush = false,
  dense = false,
  className,
  children,
}: OverviewSectionProps) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b border-border',
          dense ? 'px-4 py-2.5' : 'px-5 py-3.5',
        )}
      >
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h3 className={cn('font-semibold text-foreground', dense ? 'text-[13px]' : 'text-sm')}>
            {title}
          </h3>
          {kicker ? <span className="truncate text-xs text-dim">{kicker}</span> : null}
        </div>
        {right ? <div className="flex flex-shrink-0 items-center gap-2">{right}</div> : null}
      </div>
      <div className={cn(flush ? '' : dense ? 'p-4' : 'p-5')}>{children}</div>
    </div>
  );
}
