import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config/api';

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  image: string;
  site: string;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const published = new Date(dateStr);
  const diffMs = now.getTime() - published.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

export function RecentDevelopments() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  // Re-render every 30s so the "Updated X ago" label stays current
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/news/general?limit=10`);
        const data = await res.json();
        if (Array.isArray(data)) {
          // Filter to articles that have an image, take first 5
          const withImages = data.filter((a: NewsArticle) => a.image);
          const final = withImages.length >= 5 ? withImages.slice(0, 5) : data.slice(0, 5);
          setArticles(final);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Error fetching recent developments:', err);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (articles.length === 0) {
    return (
      <div className="bg-sidebar-accent rounded-xl p-6 border border-border">
        <div className="text-muted-foreground">Loading recent developments...</div>
      </div>
    );
  }

  return (
    <div className="bg-sidebar-accent rounded-xl p-6 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-page-heading)' }}>Recent Developments</h2>
        {lastUpdated && (
          <span className="inline-flex items-center gap-2 text-xs text-dim">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
            </span>
            Updated {timeAgo(lastUpdated.toISOString())}
          </span>
        )}
      </div>

      {/* Articles Grid - 5 cards in a row */}
      <div className="grid grid-cols-5 gap-4">
        {articles.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-muted/60 rounded-lg border border-secondary/50 overflow-hidden hover:border-secondary transition-all duration-200 flex flex-col"
          >
            {/* Article Image */}
            <div className="relative w-full h-36 overflow-hidden bg-muted">
              {article.image ? (
                <img
                  src={article.image}
                  alt={article.headline}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-dim text-xs">
                  No image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
              {/* Source & Time */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-author)' }}>
                  {article.source}
                </span>
                <span className="text-[10px] text-dim">
                  {timeAgo(article.publishedAt)}
                </span>
              </div>

              {/* Headline */}
              <h3 className="text-sm font-semibold text-foreground leading-snug mb-2 line-clamp-3 group-hover:text-foreground transition-colors">
                {article.headline}
              </h3>

              {/* Summary */}
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5 flex-1">
                {article.summary}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
