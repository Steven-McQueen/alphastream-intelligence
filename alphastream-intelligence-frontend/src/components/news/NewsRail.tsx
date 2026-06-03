import type { MarketNewsItem } from '@/types';
import { timeAgo } from './NewsCard';

interface NewsRailProps {
  topHeadlines: MarketNewsItem[];
}

export function NewsRail({ topHeadlines }: NewsRailProps) {
  if (!topHeadlines.length) return null;

  return (
    <aside className="rounded-xl border border-border bg-sidebar-accent p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
        <span className="h-4 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-sub">Top Headlines</p>
      </div>
      <ol className="space-y-0">
        {topHeadlines.map((article, index) => (
          <li key={`${article.id}-${index}`} className="border-b border-border/60 last:border-b-0">
            <a
              href={article.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-3 py-3"
            >
              <span className="font-page-heading text-lg leading-none text-dim transition-colors group-hover:text-[var(--text-author)]">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h4 className="line-clamp-3 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-sub">
                  {article.headline}
                </h4>
                <div className="mt-1 flex items-center gap-2 text-[0.7rem] text-dim">
                  {article.source ? (
                    <span className="font-semibold uppercase tracking-wide text-sub">{article.source}</span>
                  ) : null}
                  {article.source && article.publishedAt ? <span aria-hidden>&middot;</span> : null}
                  {article.publishedAt ? <span>{timeAgo(article.publishedAt)}</span> : null}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
