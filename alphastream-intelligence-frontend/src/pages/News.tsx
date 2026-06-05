import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNewsFeed, useTopStories } from '@/hooks/useNews';
import { NEWS_CATEGORIES, type MarketNewsItem, type NewsCategoryId } from '@/types';
import { NewsCard, timeAgo } from '@/components/news/NewsCard';
import { NewsHero } from '@/components/news/NewsHero';
import { NewsRail } from '@/components/news/NewsRail';
import { NewsSkeleton } from '@/components/news/NewsSkeleton';
import { NewsCategoryNav } from '@/components/news/NewsCategoryNav';
import { LiveMarketVideo } from '@/components/news/LiveMarketVideo';

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-5 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
      <h2 className="font-page-heading text-xl font-semibold text-foreground">{label}</h2>
    </div>
  );
}

function dedupe(articles: MarketNewsItem[]): MarketNewsItem[] {
  const seen = new Set<string>();
  const out: MarketNewsItem[] = [];
  for (const a of articles) {
    const key = (a.url || a.headline || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

export default function News() {
  const [category, setCategory] = useState<NewsCategoryId>('all');
  const { data: rawFeed = [], isLoading } = useNewsFeed(category, 80);
  const { data: rawTop = [] } = useTopStories(15);

  const feed = useMemo(() => dedupe(rawFeed), [rawFeed]);
  const topStories = useMemo(() => dedupe(rawTop).slice(0, 12), [rawTop]);

  const heroArticles = useMemo(() => feed.slice(0, 3), [feed]);
  const stripArticles = useMemo(() => feed.slice(3, 9), [feed]);
  const remaining = useMemo(() => feed.slice(9), [feed]);
  const lastUpdated = feed[0]?.publishedAt || topStories[0]?.publishedAt || '';

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-5 py-6">
        {/* Masthead */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <h1 className="font-page-heading text-[34px] font-semibold leading-none text-foreground">
                The Newsroom
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Institutional-grade market intelligence across macro, earnings, and sectors.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-dim">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
              </span>
              <span className="font-semibold uppercase tracking-wide text-sub">Live</span>
              {lastUpdated ? <span>&middot; Updated {timeAgo(lastUpdated)}</span> : null}
            </div>
          </div>
          <NewsCategoryNav activeCategory={category} onChange={setCategory} />
        </header>

        <LiveMarketVideo />

        {isLoading ? (
          <NewsSkeleton />
        ) : feed.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-dim">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Building your newsroom feed...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
            {/* Main column */}
            <div className="space-y-8 xl:col-span-8">
              <NewsHero articles={heroArticles} />

              {stripArticles.length > 0 && (
                <section className="space-y-4 border-t border-border pt-6">
                  <SectionHeading label={category === 'all' ? 'Top Stories' : NEWS_CATEGORIES.find((c) => c.id === category)?.label ?? 'Latest'} />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {stripArticles.map((article) => (
                      <NewsCard key={article.id} article={article} variant="standard" />
                    ))}
                  </div>
                </section>
              )}

              {category === 'all' ? (
                NEWS_CATEGORIES.filter((tab) => tab.id !== 'all').map((tab) => {
                  const sectionRows = remaining.filter((a) => a.category === tab.id).slice(0, 4);
                  if (sectionRows.length < 2) return null;
                  return (
                    <section key={tab.id} className="space-y-4 border-t border-border pt-6">
                      <div className="flex items-center justify-between">
                        <SectionHeading label={tab.label} />
                        <button
                          type="button"
                          onClick={() => setCategory(tab.id)}
                          className="text-xs font-semibold uppercase tracking-wide text-dim transition-colors hover:text-[var(--text-author)]"
                        >
                          View all
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {sectionRows.map((article) => (
                          <NewsCard key={article.id} article={article} variant="standard" />
                        ))}
                      </div>
                    </section>
                  );
                })
              ) : (
                remaining.length > 0 && (
                  <section className="space-y-4 border-t border-border pt-6">
                    <SectionHeading label="More coverage" />
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {remaining.map((article) => (
                        <NewsCard key={article.id} article={article} variant="standard" />
                      ))}
                    </div>
                  </section>
                )
              )}
            </div>

            {/* Right rail */}
            <div className="xl:col-span-4">
              <div className="space-y-5 xl:sticky xl:top-4">
                <NewsRail topHeadlines={topStories} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
