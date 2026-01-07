import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScreenerPreview } from '@/data/mockFinanceHome';

export function ScreenerSnapshot() {
  const navigate = useNavigate();
  const items = getScreenerPreview();

  const handleTickerClick = (ticker: string) => {
    const prompt = `Analyze ${ticker} as a long-term quality growth stock.`;
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">My Screener</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate('/screener')}
          >
            Open full screener
            <ExternalLink className="h-3 w-3 ml-1.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Ticker Chips */}
        <div className="flex flex-wrap gap-2">
          {items.slice(0, 8).map((item) => (
            <Badge
              key={item.ticker}
              variant="outline"
              className={cn(
                'cursor-pointer hover:bg-muted transition-colors px-2 py-1',
                item.change1D >= 0 ? 'border-positive/30' : 'border-negative/30'
              )}
              onClick={() => handleTickerClick(item.ticker)}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full mr-1.5',
                  item.change1D >= 0 ? 'bg-positive' : 'bg-negative'
                )}
              />
              <span className="font-mono font-medium">{item.ticker}</span>
              <span className={cn(
                'ml-1.5 font-mono text-[10px]',
                item.change1D >= 0 ? 'text-positive' : 'text-negative'
              )}>
                {item.change1D >= 0 ? '+' : ''}{item.change1D.toFixed(1)}%
              </span>
            </Badge>
          ))}
        </div>

        {/* Mini Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ticker</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">1D %</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">1W %</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Sector</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 6).map((item) => (
                <tr
                  key={item.ticker}
                  onClick={() => handleTickerClick(item.ticker)}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-2 font-mono font-semibold">{item.ticker}</td>
                  <td className={cn(
                    'py-2 px-2 text-right font-mono',
                    item.change1D >= 0 ? 'text-positive' : 'text-negative'
                  )}>
                    {item.change1D >= 0 ? '+' : ''}{item.change1D.toFixed(2)}%
                  </td>
                  <td className={cn(
                    'py-2 px-2 text-right font-mono',
                    item.change1W >= 0 ? 'text-positive' : 'text-negative'
                  )}>
                    {item.change1W >= 0 ? '+' : ''}{item.change1W.toFixed(2)}%
                  </td>
                  <td className="py-2 px-2 text-muted-foreground truncate max-w-[100px]">
                    {item.sector}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className={cn(
                      'font-mono',
                      item.sentimentScore >= 70 ? 'text-positive' :
                      item.sentimentScore >= 40 ? 'text-warning' : 'text-negative'
                    )}>
                      {item.sentimentScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
