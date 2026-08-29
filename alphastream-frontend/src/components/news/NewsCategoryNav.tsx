import { cn } from '@/lib/utils';
import { NEWS_CATEGORIES, type NewsCategoryId } from '@/types';

interface NewsCategoryNavProps {
  activeCategory: NewsCategoryId;
  onChange: (category: NewsCategoryId) => void;
}

export function NewsCategoryNav({ activeCategory, onChange }: NewsCategoryNavProps) {
  return (
    <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 border-y border-border">
      {NEWS_CATEGORIES.map((tab) => {
        const active = tab.id === activeCategory;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-3 py-2.5 text-[0.8rem] font-semibold uppercase tracking-wide transition-colors',
              active ? 'text-foreground' : 'text-dim hover:text-sub',
            )}
          >
            {tab.label}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--text-author)]" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
