import { usePortfolio } from '@/context/PortfolioContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Generate mock news summary based on holdings
function generateNewsSummary(holdings: { ticker: string; name: string; dailyPnLPercent: number }[]) {
  const sortedByChange = [...holdings].sort((a, b) => Math.abs(b.dailyPnLPercent) - Math.abs(a.dailyPnLPercent));
  const topMovers = sortedByChange.slice(0, 5);

  const newsSnippets = [
    { ticker: 'NVDA', news: 'surged on strong AI chip demand forecasts and upgraded analyst ratings following data center growth projections' },
    { ticker: 'AAPL', news: 'traded higher as Vision Pro pre-orders exceeded expectations and services revenue guidance was raised' },
    { ticker: 'MSFT', news: 'climbed on Azure cloud growth acceleration and expanded Copilot enterprise adoption announcements' },
    { ticker: 'META', news: 'gained ground after Reality Labs cost cuts and improved advertising efficiency metrics' },
    { ticker: 'GOOGL', news: 'rose on Gemini AI momentum and YouTube Premium subscriber growth beating estimates' },
    { ticker: 'AMZN', news: 'advanced following AWS margin expansion and Prime membership reaching new highs' },
    { ticker: 'XOM', news: 'moved higher on rising crude prices and successful Guyana production ramp-up' },
    { ticker: 'JNJ', news: 'declined amid ongoing talc litigation concerns despite strong pharmaceutical pipeline updates' },
    { ticker: 'V', news: 'traded steady as cross-border transaction volumes continue recovering to pre-pandemic levels' },
    { ticker: 'HD', news: 'faced pressure from housing slowdown concerns offset by Pro customer segment strength' },
  ];

  return topMovers.map((holding) => {
    const snippet = newsSnippets.find((n) => n.ticker === holding.ticker);
    return {
      ...holding,
      news: snippet?.news || `moved ${holding.dailyPnLPercent > 0 ? 'higher' : 'lower'} in today's session amid broader market activity`,
    };
  });
}

export function PortfolioNewsSummary() {
  const { holdings } = usePortfolio();
  const newsItems = generateNewsSummary(holdings);

  const sources = ['Reuters', 'Bloomberg', 'WSJ', 'CNBC', 'Barrons'];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Portfolio News Summary</h3>
        <span className="text-xs text-muted-foreground">Updated 2 minutes ago</span>
      </div>

      <div className="text-sm leading-relaxed text-foreground/90">
        <span className="text-muted-foreground">Your portfolio showed </span>
        {newsItems.map((item, index) => (
          <span key={item.ticker}>
            <span className="font-semibold text-foreground">{item.name.split(' ')[0]}</span>
            {' '}
            <Badge
              variant="outline"
              className={`inline-flex items-center gap-0.5 px-1.5 py-0 text-xs font-medium ${
                item.dailyPnLPercent >= 0
                  ? 'text-green-400 border-green-400/30 bg-green-400/10'
                  : 'text-red-400 border-red-400/30 bg-red-400/10'
              }`}
            >
              {item.dailyPnLPercent >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(item.dailyPnLPercent).toFixed(2)}%
            </Badge>
            {' '}
            <span className="text-muted-foreground">{item.news}</span>
            {index < newsItems.length - 1 && <span className="text-muted-foreground">. </span>}
          </span>
        ))}
        <span className="text-muted-foreground">.</span>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1">
          {sources.slice(0, 4).map((source) => (
            <Badge key={source} variant="secondary" className="text-[10px] px-1.5 py-0">
              {source}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}
