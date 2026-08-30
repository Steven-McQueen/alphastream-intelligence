import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/config/api";
import { OverviewSection } from "./OverviewSection";

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
  /** ticker = company news; market = general market feed (indices). */
  feed?: "ticker" | "market";
  title?: string;
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

export function StockNews({ ticker, feed = "ticker", title = "Related News" }: StockNewsProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      if (!ticker && feed === "ticker") return;

      try {
        setLoading(true);
        setError(null);
        const url =
          feed === "market"
            ? `${API_BASE_URL}/api/news/general?limit=20`
            : `${API_BASE_URL}/api/news/${encodeURIComponent(ticker)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch news");
        const data = await res.json();
        const normalized: NewsArticle[] = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
          symbol: String(row.symbol ?? ticker ?? ""),
          publishedDate: String(row.publishedDate ?? row.publishedAt ?? ""),
          publisher: String(row.publisher ?? row.source ?? ""),
          title: String(row.title ?? row.headline ?? ""),
          image: String(row.image ?? ""),
          site: String(row.site ?? row.source ?? ""),
          text: String(row.text ?? row.summary ?? ""),
          url: String(row.url ?? ""),
        }));
        setNews(normalized.slice(0, 10));
      } catch (err) {
        console.error("Error fetching news:", err);
        setError("Failed to load news");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [ticker, feed]);

  const countChip =
    !loading && news.length > 0 ? (
      <span className="text-xs text-dim">{news.length} stories</span>
    ) : null;

  // Different sizing: first story is featured, the rest are a compact list.
  const featured = news[0];
  const rest = news.slice(1);

  return (
    <OverviewSection title={title} kicker="Coverage" right={countChip} flush>
      {loading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm italic text-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading news...
        </div>
      ) : error || news.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-dim">
          {error || "No recent news available."}
        </div>
      ) : (
        <div className="p-4">
          {/* Featured story (larger) */}
          {featured ? (
            <a
              href={featured.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group mb-4 block overflow-hidden rounded-lg border border-border transition-colors hover:border-secondary"
            >
              {featured.image ? (
                <div className="relative h-44 w-full overflow-hidden bg-muted">
                  <img
                    src={featured.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              ) : null}
              <div className="p-4">
                <h4 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-sub">
                  {featured.title}
                </h4>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {featured.text}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 text-[0.7rem] text-dim">
                  {featured.publisher ? (
                    <span className="font-semibold uppercase tracking-wide text-sub">{featured.publisher}</span>
                  ) : null}
                  {featured.publisher && featured.publishedDate ? <span aria-hidden>&middot;</span> : null}
                  {featured.publishedDate ? <span>{formatRelativeTime(featured.publishedDate)}</span> : null}
                </div>
              </div>
            </a>
          ) : null}

          {/* Remaining stories (compact rows) */}
          <div className="divide-y divide-border/50">
            {rest.map((article, idx) => (
              <a
                key={idx}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 rounded-md p-2.5 transition-colors hover:bg-muted/40"
              >
                {article.image ? (
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    <img
                      src={article.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col">
                  <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-sub">
                    {article.title}
                  </h4>
                  <div className="mt-auto flex flex-wrap items-center gap-x-2 pt-1.5 text-[0.7rem] text-dim">
                    {article.publisher ? (
                      <span className="font-semibold uppercase tracking-wide text-sub">{article.publisher}</span>
                    ) : null}
                    {article.publisher && article.publishedDate ? <span aria-hidden>&middot;</span> : null}
                    {article.publishedDate ? <span>{formatRelativeTime(article.publishedDate)}</span> : null}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </OverviewSection>
  );
}
