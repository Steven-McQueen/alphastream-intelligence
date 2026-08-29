import { useMemo } from 'react';
import { getStockByTicker } from '@/data/mockStocks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, TrendingDown, Minus, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HoldingsNewsFeedProps {
  tickers: string[];
}

interface NewsItem {
  id: string;
  ticker: string;
  companyName: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: Date;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  change1D: number;
}

const NEWS_HEADLINES: Record<string, { headline: string; summary: string; sentiment: 'bullish' | 'bearish' | 'neutral' }[]> = {
  AAPL: [
    { headline: 'Apple announces new AI features for iPhone', summary: 'Apple Intelligence brings on-device AI to the latest iPhones, enhancing Siri and adding new productivity features.', sentiment: 'bullish' },
    { headline: 'Apple reports strong services revenue growth', summary: 'Q4 services segment hits record revenue, offsetting slower hardware sales in key markets.', sentiment: 'bullish' },
  ],
  MSFT: [
    { headline: 'Microsoft Azure growth accelerates on AI demand', summary: 'Cloud revenue surges as enterprises adopt AI workloads, driving Azure consumption higher than expected.', sentiment: 'bullish' },
    { headline: 'Copilot adoption drives Office 365 renewals', summary: 'Enterprise customers increasingly bundling AI assistant with productivity suite subscriptions.', sentiment: 'bullish' },
  ],
  NVDA: [
    { headline: 'NVIDIA Blackwell GPUs see unprecedented demand', summary: 'Next-gen AI chips sold out for quarters ahead as hyperscalers race to expand capacity.', sentiment: 'bullish' },
    { headline: 'Jensen Huang keynote highlights AI infrastructure boom', summary: 'CEO outlines $1 trillion opportunity in accelerated computing transformation.', sentiment: 'bullish' },
  ],
  GOOGL: [
    { headline: 'Google Search maintains dominance despite AI chatbot threat', summary: 'Advertising revenue grows steadily as AI Overviews increase user engagement.', sentiment: 'neutral' },
    { headline: 'Gemini AI model rivals GPT-4 in benchmarks', summary: 'Google DeepMind releases Gemini 2.0, claiming state-of-the-art performance.', sentiment: 'bullish' },
  ],
  AMZN: [
    { headline: 'AWS re:Invent showcases new AI services', summary: 'Amazon announces Bedrock updates and custom silicon for AI workloads.', sentiment: 'bullish' },
    { headline: 'Amazon Prime membership hits new record', summary: 'E-commerce giant reports strongest holiday shopping season in company history.', sentiment: 'bullish' },
  ],
  META: [
    { headline: 'Meta Reality Labs losses narrow on Quest sales', summary: 'VR headset shipments increase as enterprise adoption gains traction.', sentiment: 'neutral' },
    { headline: 'Instagram Reels ad revenue surges', summary: 'Short-form video monetization closes gap with TikTok on engagement metrics.', sentiment: 'bullish' },
  ],
  V: [
    { headline: 'Visa reports strong cross-border payment volumes', summary: 'International travel recovery drives premium card spending higher.', sentiment: 'bullish' },
  ],
  JNJ: [
    { headline: 'J&J cancer drug receives FDA breakthrough designation', summary: 'Oncology pipeline strengthens with promising Phase 3 trial results.', sentiment: 'bullish' },
  ],
  UNH: [
    { headline: 'UnitedHealth expands Medicare Advantage footprint', summary: 'Insurer adds new markets and benefits for 2025 enrollment period.', sentiment: 'bullish' },
  ],
  XOM: [
    { headline: 'Exxon completes Pioneer acquisition', summary: 'Oil major becomes largest Permian Basin producer following $60B deal closure.', sentiment: 'neutral' },
  ],
  CVX: [
    { headline: 'Chevron boosts dividend amid strong cash flow', summary: 'Energy giant raises quarterly payout, extending dividend growth streak.', sentiment: 'bullish' },
  ],
  HD: [
    { headline: 'Home Depot sees pro segment outperform DIY', summary: 'Professional contractor sales remain resilient despite housing slowdown.', sentiment: 'neutral' },
  ],
  PG: [
    { headline: 'P&G raises prices on household goods', summary: 'Consumer staples giant expects margin improvement from pricing actions.', sentiment: 'neutral' },
  ],
  KO: [
    { headline: 'Coca-Cola zero-sugar portfolio drives growth', summary: 'Healthier beverage options gain market share in key demographics.', sentiment: 'bullish' },
  ],
};

const SOURCES = ['Bloomberg', 'Reuters', 'WSJ', 'CNBC', 'Financial Times', 'Barrons', 'MarketWatch'];

function generateMockNews(tickers: string[]): NewsItem[] {
  const news: NewsItem[] = [];
  const now = new Date();

  tickers.forEach((ticker) => {
    const stock = getStockByTicker(ticker);
    if (!stock) return;

    const tickerNews = NEWS_HEADLINES[ticker];
    if (tickerNews) {
      tickerNews.forEach((item, index) => {
        news.push({
          id: `${ticker}-${index}`,
          ticker,
          companyName: stock.name,
          headline: item.headline,
          summary: item.summary,
          source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
          publishedAt: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000),
          sentiment: item.sentiment,
          change1D: stock.change1D,
        });
      });
    } else {
      // Generate generic news for tickers without specific headlines
      const sentiment: 'bullish' | 'bearish' | 'neutral' = stock.change1D > 1 ? 'bullish' : stock.change1D < -1 ? 'bearish' : 'neutral';
      news.push({
        id: `${ticker}-0`,
        ticker,
        companyName: stock.name,
        headline: `${stock.name} ${stock.change1D >= 0 ? 'rises' : 'falls'} on market activity`,
        summary: `Shares ${stock.change1D >= 0 ? 'gained' : 'declined'} ${Math.abs(stock.change1D).toFixed(1)}% in today's trading session.`,
        source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
        publishedAt: new Date(now.getTime() - Math.random() * 12 * 60 * 60 * 1000),
        sentiment,
        change1D: stock.change1D,
      });
    }
  });

  // Sort by most recent
  return news.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

const sentimentConfig = {
  bullish: { icon: TrendingUp, className: 'text-positive' },
  bearish: { icon: TrendingDown, className: 'text-negative' },
  neutral: { icon: Minus, className: 'text-muted-foreground' },
};

export function HoldingsNewsFeed({ tickers }: HoldingsNewsFeedProps) {
  const news = useMemo(() => generateMockNews(tickers), [tickers]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Portfolio News</span>
        <span className="text-xs text-muted-foreground ml-auto">{news.length} articles</span>
      </div>

      {/* News List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {news.map((item) => {
            const SentimentIcon = sentimentConfig[item.sentiment].icon;
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="font-mono text-[10px] h-5">
                    {item.ticker}
                  </Badge>
                  <span
                    className={cn(
                      'text-[10px] font-mono flex items-center gap-0.5',
                      item.change1D >= 0 ? 'text-positive' : 'text-negative'
                    )}
                  >
                    {item.change1D >= 0 ? '+' : ''}
                    {item.change1D.toFixed(2)}%
                  </span>
                  <SentimentIcon className={cn('h-3 w-3 ml-auto', sentimentConfig[item.sentiment].className)} />
                </div>

                {/* Headline */}
                <h4 className="text-xs font-medium leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                  {item.headline}
                </h4>

                {/* Summary */}
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mb-1.5">
                  {item.summary}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{item.source}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(item.publishedAt)}</span>
                  <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
