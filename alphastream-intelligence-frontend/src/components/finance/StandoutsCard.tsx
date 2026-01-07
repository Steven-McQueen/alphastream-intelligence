import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { getStandouts } from '@/data/mockFinanceHome';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export function StandoutsCard() {
  const navigate = useNavigate();
  const standouts = getStandouts();

  const handleAskWhy = () => {
    const prompt = "Analyze why these standout names might be mispriced and how they fit in a quality growth portfolio.";
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  const getTagColor = (tag: string) => {
    if (tag.includes('High') || tag.includes('Beat')) return 'bg-positive/20 text-positive border-positive/30';
    if (tag.includes('Insider')) return 'bg-warning/20 text-warning border-warning/30';
    if (tag.includes('Upgrade') || tag.includes('Growth')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (tag.includes('Momentum') || tag.includes('Breakout')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (tag.includes('Dividend')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Notable Standouts</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {standouts.slice(0, 5).map((stock) => (
          <div
            key={stock.ticker}
            className="flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0"
          >
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sm">{stock.ticker}</span>
                <span className="text-xs text-muted-foreground truncate">{stock.name}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {stock.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 ${getTagColor(tag)}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {stock.explanation}
              </p>
            </div>
            <div className="w-16 h-10 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stock.sparklineData.map((v, i) => ({ i, v }))}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
        <Button
          variant="link"
          className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
          onClick={handleAskWhy}
        >
          Ask why these names matter
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
