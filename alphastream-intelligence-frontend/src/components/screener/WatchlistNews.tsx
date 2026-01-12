import { useState, useEffect } from "react";
import { ExternalLink, Loader2, Newspaper, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL = "http://localhost:8000";

interface NewsArticle {
  symbol: string;
  publishedDate: string;
  publisher: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
}

interface WatchlistNewsProps {
  tickers: string[];
  maxArticles?: number;
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function WatchlistNews({ tickers, maxArticles = 12 }: WatchlistNewsProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch news for all tickers
  useEffect(() => {
    const fetchNews = async () => {
      if (tickers.length === 0) {
        setArticles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch news for each ticker in parallel
        const fetchPromises = tickers.map(async (ticker) => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/news/${ticker}`);
            if (!res.ok) return [];
            return await res.json();
          } catch {
            return [];
          }
        });

        const results = await Promise.all(fetchPromises);
        
        // Combine and deduplicate by URL
        const allArticles: NewsArticle[] = [];
        const seenUrls = new Set<string>();
        
        results.flat().forEach((article: NewsArticle) => {
          if (article.url && !seenUrls.has(article.url)) {
            seenUrls.add(article.url);
            allArticles.push(article);
          }
        });

        // Sort by date (newest first)
        allArticles.sort((a, b) => {
          const dateA = new Date(a.publishedDate).getTime();
          const dateB = new Date(b.publishedDate).getTime();
          return dateB - dateA;
        });

        // Limit to maxArticles
        setArticles(allArticles.slice(0, maxArticles));
      } catch (err) {
        console.error("Error fetching watchlist news:", err);
        setError("Failed to load news");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchNews();
  }, [tickers, maxArticles]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLoading(true);
    // The effect will re-run because loading state changes
  };

  if (tickers.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-center h-32 text-zinc-500">
          <p>Add stocks to your watchlist to see related news</p>
        </div>
      </div>
    );
  }

  if (loading && !isRefreshing) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-center h-32 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          Watchlist News
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-center h-32 text-zinc-500">
            <p>No news available for your watchlist stocks</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article, idx) => (
            <a
              key={article.url || idx}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all"
            >
              <div className="flex gap-4 p-4">
                {/* Image */}
                {article.image && (
                  <div className="flex-shrink-0">
                    <img
                      src={article.image}
                      alt=""
                      className="w-24 h-20 object-cover rounded-lg bg-zinc-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h4 className="text-sm font-medium text-white leading-snug mb-2 group-hover:text-emerald-400 transition-colors line-clamp-2">
                    {article.title}
                  </h4>
                  
                  {/* Description */}
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-2">
                    {article.text}
                  </p>
                  
                  {/* Footer */}
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <span className="text-zinc-400">{article.publisher || article.site}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(article.publishedDate)}</span>
                    <span>·</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                      ${article.symbol}
                    </span>
                    <ExternalLink className="w-3 h-3 ml-auto text-zinc-600 group-hover:text-zinc-400" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
