import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMarket } from '@/context/MarketContext';
import { Newspaper, TrendingUp, TrendingDown, Minus, Clock, ExternalLink, Loader2, Bell } from 'lucide-react';
import type { MarketNewsItem } from '@/types';
import { cn } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  macro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  earnings: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  sector: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  geopolitical: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  fed: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  general: 'bg-muted text-muted-foreground border-border',
};

const sentimentConfig = {
  bullish: { icon: TrendingUp, className: 'text-emerald-400' },
  bearish: { icon: TrendingDown, className: 'text-rose-400' },
  neutral: { icon: Minus, className: 'text-muted-foreground' },
};

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString();
}

function NewsItem({ item, isNew }: { item: MarketNewsItem; isNew?: boolean }) {
  const SentimentIcon = sentimentConfig[item.sentiment].icon;
  
  return (
    <div 
      className={cn(
        "group p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-accent/30 transition-all cursor-pointer",
        isNew && "animate-in slide-in-from-top-2 duration-300 ring-1 ring-primary/30 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${sentimentConfig[item.sentiment].className}`}>
          <SentimentIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {item.headline}
            </h4>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.summary}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${categoryColors[item.category]}`}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Badge>
            {item.tickers?.slice(0, 3).map((ticker) => (
              <Badge key={ticker} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {ticker}
              </Badge>
            ))}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(item.publishedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketNewsSummary() {
  const { news, newsLoading, newNewsCount, markNewsAsRead } = useMarket();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  
  // Mark news as read when scrolling to top
  useEffect(() => {
    if (newNewsCount > 0) {
      const timer = setTimeout(markNewsAsRead, 3000);
      return () => clearTimeout(timer);
    }
  }, [newNewsCount, markNewsAsRead]);
  
  // Count sentiment distribution
  const sentimentCounts = news.reduce(
    (acc, item) => {
      acc[item.sentiment]++;
      return acc;
    },
    { bullish: 0, bearish: 0, neutral: 0 }
  );
  
  const totalNews = news.length;
  const bullishPercent = Math.round((sentimentCounts.bullish / totalNews) * 100);
  const bearishPercent = Math.round((sentimentCounts.bearish / totalNews) * 100);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Market Summary</CardTitle>
            {newsLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {newNewsCount > 0 && (
              <Badge variant="default" className="h-5 px-1.5 text-[10px] gap-1 animate-pulse">
                <Bell className="h-3 w-3" />
                {newNewsCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Live</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-muted-foreground ml-2">{today}</span>
          </div>
        </div>
        {/* Sentiment bar */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-emerald-400">Bullish {bullishPercent}%</span>
            <span className="text-rose-400">Bearish {bearishPercent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500" 
              style={{ width: `${bullishPercent}%` }} 
            />
            <div 
              className="h-full bg-muted-foreground/30 transition-all duration-500" 
              style={{ width: `${100 - bullishPercent - bearishPercent}%` }} 
            />
            <div 
              className="h-full bg-rose-500 transition-all duration-500" 
              style={{ width: `${bearishPercent}%` }} 
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[320px] pr-3" ref={scrollRef}>
          <div className="space-y-2">
            {news.map((item, index) => (
              <NewsItem 
                key={item.id} 
                item={item} 
                isNew={index === 0 && newNewsCount > 0}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}