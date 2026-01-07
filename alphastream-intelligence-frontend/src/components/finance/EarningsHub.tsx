import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEarningsHighlights } from '@/data/mockFinanceHome';

type EarningsFilter = 'upcoming' | 'recent';
type DateFilter = 'today' | 'week';

export function EarningsHub() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<EarningsFilter>('upcoming');
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const earnings = getEarningsHighlights(filter);

  const handleAnalyze = (ticker: string) => {
    const prompt = `Summarize the last earnings report and risks for ${ticker}.`;
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'Key Watch':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'High IV':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'Growth':
        return 'bg-positive/20 text-positive border-positive/30';
      case 'Value':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Dividend':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Earnings Hub</CardTitle>
          <div className="flex items-center gap-3">
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as EarningsFilter)}
              className="h-7"
            >
              <ToggleGroupItem
                value="upcoming"
                className="h-6 px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Upcoming
              </ToggleGroupItem>
              <ToggleGroupItem
                value="recent"
                className="h-6 px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Recent
              </ToggleGroupItem>
            </ToggleGroup>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-28 h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ticker</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Company</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Exp EPS</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Last Surprise</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Tag</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((item) => (
                <tr key={item.ticker} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-2 font-mono font-semibold">{item.ticker}</td>
                  <td className="py-2.5 px-2 text-muted-foreground truncate max-w-[150px]">{item.company}</td>
                  <td className="py-2.5 px-2">
                    <span className="text-muted-foreground">{item.date}</span>
                    <span className="text-[10px] text-muted-foreground/70 ml-1">{item.timing}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">${item.expectedEPS.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={cn(
                      'font-mono',
                      item.lastSurprise >= 0 ? 'text-positive' : 'text-negative'
                    )}>
                      {item.lastSurprise >= 0 ? '+' : ''}{item.lastSurprise.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <Badge variant="outline" className={cn('text-[10px]', getTagColor(item.tag))}>
                      {item.tag}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-primary hover:text-primary"
                      onClick={() => handleAnalyze(item.ticker)}
                    >
                      Analyze
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-3">
          <Button variant="link" className="p-0 h-auto text-sm text-muted-foreground hover:text-primary">
            View full earnings calendar
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
