import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MarketNewsItem } from '@/types';
import { cn } from '@/lib/utils';

interface IndexNewsFeedProps {
  news: MarketNewsItem[];
  indexName: string;
}

const sentimentConfig = {
  bullish: { icon: TrendingUp, className: 'text-positive' },
  bearish: { icon: TrendingDown, className: 'text-negative' },
  neutral: { icon: Minus, className: 'text-muted-foreground' },
};

const categoryColors: Record<string, string> = {
  macro: 'bg-blue-500/10 text-blue-500',
  earnings: 'bg-emerald-500/10 text-emerald-500',
  sector: 'bg-violet-500/10 text-violet-500',
  geopolitical: 'bg-amber-500/10 text-amber-500',
  fed: 'bg-rose-500/10 text-rose-500',
  general: 'bg-muted text-muted-foreground',
};

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function IndexNewsFeed({ news, indexName }: IndexNewsFeedProps) {
  return (
    <Card className="flex flex-col h-[400px] bg-card border-border">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground">Related News</h3>
        <Badge variant="outline" className="ml-auto text-xs">
          {news.length} articles
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        {news.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No recent news for {indexName}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {news.map((item) => {
              const SentimentIcon = sentimentConfig[item.sentiment].icon;
              
              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex-shrink-0 p-1.5 rounded',
                      sentimentConfig[item.sentiment].className,
                      'bg-current/10'
                    )}>
                      <SentimentIcon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="secondary" 
                          className={cn('text-[10px] px-1.5 py-0', categoryColors[item.category])}
                        >
                          {item.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {item.source} · {formatTimeAgo(item.publishedAt)}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                      </div>
                      
                      <h4 className="text-sm font-medium text-foreground mb-1 line-clamp-2">
                        {item.headline}
                      </h4>
                      
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.summary}
                      </p>
                      
                      {item.tickers && item.tickers.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {item.tickers.slice(0, 4).map((ticker) => (
                            <Badge
                              key={ticker}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-mono"
                            >
                              {ticker}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
