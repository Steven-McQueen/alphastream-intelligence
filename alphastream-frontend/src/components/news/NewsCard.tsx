import { cn } from '@/lib/utils';
import { NEWS_CATEGORIES, type MarketNewsItem } from '@/types';

type NewsCardVariant = 'hero' | 'feature' | 'standard' | 'compact';

const imageHeights: Record<NewsCardVariant, string> = {
  hero: 'h-[20rem] sm:h-[24rem]',
  feature: 'h-44',
  standard: 'h-40',
  compact: 'h-20 w-28',
};

const titleSizes: Record<NewsCardVariant, string> = {
  hero: 'text-2xl sm:text-[28px] leading-tight',
  feature: 'text-lg leading-snug',
  standard: 'text-base leading-snug',
  compact: 'text-sm leading-snug',
};

const CATEGORY_LABELS: Record<string, string> = NEWS_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<string, string>,
);

export function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const published = new Date(dateStr);
  const diffMs = now.getTime() - published.getTime();
  if (Number.isNaN(diffMs)) return '';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || 'Markets';
}

interface NewsCardProps {
  article: MarketNewsItem;
  variant?: NewsCardVariant;
  className?: string;
  serifHeadline?: boolean;
  showKicker?: boolean;
}

function MetaRow({ article }: { article: MarketNewsItem }) {
  const source = article.source || article.site;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-dim">
      {source ? <span className="font-semibold uppercase tracking-wide text-sub">{source}</span> : null}
      {source && article.publishedAt ? <span aria-hidden>&middot;</span> : null}
      {article.publishedAt ? <span>{timeAgo(article.publishedAt)}</span> : null}
    </div>
  );
}

export function NewsCard({
  article,
  variant = 'standard',
  className,
  serifHeadline = false,
  showKicker = true,
}: NewsCardProps) {
  const hasImage = Boolean(article.image);
  const kicker = categoryLabel(article.category);

  // Compact rows: thumbnail-left list item.
  if (variant === 'compact') {
    return (
      <a
        href={article.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group flex gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50',
          className,
        )}
      >
        {hasImage ? (
          <div className={cn('shrink-0 overflow-hidden rounded-md bg-muted', imageHeights.compact)}>
            <img
              src={article.image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-sub">
            {article.headline}
          </h4>
          <div className="mt-1">
            <MetaRow article={article} />
          </div>
        </div>
      </a>
    );
  }

  // Image-less editorial card: typographic, with a top accent rule.
  if (!hasImage) {
    return (
      <a
        href={article.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'group flex flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-secondary',
          className,
        )}
      >
        <span className="mb-3 h-[2px] w-10 rounded-full bg-[var(--text-author)]" aria-hidden />
        {showKicker ? <span className="news-kicker mb-2">{kicker}</span> : null}
        <h3
          className={cn(
            'mb-2 line-clamp-4 font-semibold text-foreground transition-colors group-hover:text-sub',
            titleSizes[variant],
            (serifHeadline || variant === 'hero') && 'font-page-heading',
          )}
        >
          {article.headline}
        </h3>
        {article.summary ? (
          <p className={cn('flex-1 text-muted-foreground', variant === 'hero' ? 'line-clamp-5 text-base leading-relaxed' : 'line-clamp-3 text-sm')}>
            {article.summary}
          </p>
        ) : null}
        <div className="mt-4">
          <MetaRow article={article} />
        </div>
      </a>
    );
  }

  // Standard image card.
  return (
    <a
      href={article.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-secondary',
        className,
      )}
    >
      <div className={cn('relative w-full overflow-hidden bg-muted', imageHeights[variant])}>
        <img
          src={article.image}
          alt={article.headline}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
        {showKicker ? (
          <span className="news-kicker absolute left-4 top-4 rounded-md bg-background/70 px-2 py-1 backdrop-blur-sm">
            {kicker}
          </span>
        ) : null}
      </div>
      <div className={cn('flex flex-1 flex-col', variant === 'hero' ? 'p-6' : 'p-5')}>
        <h3
          className={cn(
            'mb-2 line-clamp-3 font-semibold text-foreground transition-colors group-hover:text-sub',
            titleSizes[variant],
            (serifHeadline || variant === 'hero') && 'font-page-heading',
          )}
        >
          {article.headline}
        </h3>
        {article.summary ? (
          <p className={cn('flex-1 text-muted-foreground', variant === 'hero' ? 'line-clamp-3 text-base leading-relaxed' : 'line-clamp-2 text-sm')}>
            {article.summary}
          </p>
        ) : null}
        <div className="mt-3">
          <MetaRow article={article} />
        </div>
      </div>
    </a>
  );
}
