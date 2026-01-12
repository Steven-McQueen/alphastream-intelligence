import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";

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

interface StockNewsProps {
  ticker: string;
}

// Format relative time (e.g., "7m ago", "2h ago", or date if > 24h)
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

export function StockNews({ ticker }: StockNewsProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      if (!ticker) return;
      
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/news/${ticker}`);
        if (!res.ok) throw new Error("Failed to fetch news");
        const data: NewsArticle[] = await res.json();
        setNews(data.slice(0, 10)); // Limit to 10 articles
      } catch (err) {
        console.error("Error fetching news:", err);
        setError("Failed to load news");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [ticker]);

  if (loading) {
    return (
      <Card className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-lg text-white">📰 Related News</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      </Card>
    );
  }

  if (error || news.length === 0) {
    return (
      <Card className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-lg text-white">📰 Related News</h3>
        </div>
        <p className="text-sm text-zinc-500 text-center py-4">
          {error || "No recent news available for this stock"}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center gap-2 mb-5">
        <h3 className="font-semibold text-lg text-white">📰 Related News</h3>
        <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
          {news.length}
        </span>
      </div>

      <div 
        className="space-y-1"
      >
        {news.map((article, idx) => (
          <a
            key={idx}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-4 p-4 rounded-xl hover:bg-zinc-800/60 transition-all duration-200 group cursor-pointer"
          >
            {/* Article Image - Left Side */}
            <div className="flex-shrink-0 w-[100px] h-[80px] rounded-xl overflow-hidden bg-zinc-800">
              {article.image ? (
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.innerHTML = 
                      '<div class="w-full h-full flex items-center justify-center text-zinc-600 text-2xl">📰</div>';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-2xl">
                  📰
                </div>
              )}
            </div>

            {/* Article Content - Right Side */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Title */}
              <h4 className="font-semibold text-[15px] text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug">
                {article.title}
              </h4>

              {/* Article Text Preview */}
              <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                {article.text}
              </p>

              {/* Footer: Publisher, Time, Ticker Badge */}
              <div className="flex items-center gap-2 mt-auto">
                <span className="text-xs font-medium text-zinc-500">
                  {article.publisher}
                </span>
                <span className="text-xs text-zinc-600">•</span>
                <span className="text-xs text-zinc-500">
                  {formatRelativeTime(article.publishedDate)}
                </span>
                <span className="text-xs text-zinc-600">•</span>
                {/* Ticker Badge */}
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs px-2 py-0.5 font-medium hover:bg-emerald-500/30">
                  ${ticker}
                </Badge>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}
