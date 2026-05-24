import { useEffect, useState } from 'react';
import { Clock3, Loader2, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface NewsArticle {
  id?: string;
  headline?: string;
  title?: string;
  summary?: string;
  text?: string;
  publishedAt?: string;
  publishedDate?: string;
  source?: string;
  publisher?: string;
  url?: string;
  image?: string;
  site?: string;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const published = new Date(dateStr);
  const diffMs = now.getTime() - published.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export default function News() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  // Re-render every 30s for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/news/general?limit=30`);
        if (res.ok) {
          const data = await res.json();
          setArticles(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching news:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-serif)' }}>
            Market News
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Latest financial news and market developments</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-dim">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading news...
          </div>
        ) : articles.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-dim">
            No news available
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article, idx) => {
              const headline = article.headline || article.title || '';
              const summary = article.summary || article.text || '';
              const published = article.publishedAt || article.publishedDate || '';
              const source = article.source || article.publisher || article.site || '';
              const image = article.image || '';

              return (
                <a
                  key={article.url || idx}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-card overflow-hidden hover:border-secondary transition-all duration-200 flex flex-col"
                >
                  {/* Image */}
                  {image && (
                    <div className="relative w-full h-44 overflow-hidden bg-muted">
                      <img
                        src={image}
                        alt={headline}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-xs text-dim mb-2">
                      <Clock3 className="h-3 w-3" />
                      <span>{timeAgo(published)}</span>
                      {source && (
                        <>
                          <span>&middot;</span>
                          <span className="text-cyan-400 uppercase text-[10px] font-semibold tracking-wider">
                            {source}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-foreground leading-snug mb-2 line-clamp-3 group-hover:text-foreground transition-colors">
                      {headline}
                    </h3>

                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                      {summary}
                    </p>

                    <div className="flex items-center gap-1 mt-3 text-xs text-dim group-hover:text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      <span>Read more</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
