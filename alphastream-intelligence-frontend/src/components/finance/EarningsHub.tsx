import { useEffect, useState } from 'react';
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

type EarningsFilter = 'upcoming' | 'recent';
type DateFilter = 'today' | 'week';

export function EarningsHub() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<EarningsFilter>('upcoming');
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    setPageSize(8);
  }, [filter, dateFilter]);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          mode: filter,
          window: dateFilter,
          limit: String(pageSize),
          offset: '0',
        });
        const res = await fetch(`http://localhost:8000/api/earnings?${params.toString()}`);
        const data = await res.json();
        setEarnings(data?.items ?? []);
        setTotal(data?.total ?? 0);
      } catch (err) {
        console.error('Error fetching earnings', err);
        setEarnings([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, [filter, dateFilter, pageSize]);

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
              <SelectItem value="week">Week</SelectItem>
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
            </thead>            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-3 px-2 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : (
                earnings.map((item) => (
                  <tr
                    key={`${item.ticker}-${item.report_date}`}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-2 font-mono font-semibold">{item.ticker}</td>
                    <td className="py-2.5 px-2 text-muted-foreground truncate max-w-[150px]">
                      {item.company_name || item.ticker}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="text-muted-foreground">{item.report_date}</span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {item.eps_estimate !== undefined && item.eps_estimate !== null
                        ? `$${Number(item.eps_estimate).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span
                        className={cn(
                          'font-mono',
                          item.last_surprise !== undefined && item.last_surprise !== null
                            ? item.last_surprise >= 0
                              ? 'text-positive'
                              : 'text-negative'
                            : 'text-muted-foreground'
                        )}
                      >
                        {item.last_surprise !== undefined && item.last_surprise !== null
                          ? `${item.last_surprise >= 0 ? '+' : ''}$${Number(item.last_surprise).toFixed(2)}`
                          : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                        {filter === 'upcoming' ? 'Upcoming' : 'Recent'}
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
                ))
              )}
            </tbody>
          </table>
        </div>
        {earnings.length < total && (
          <div className="flex justify-center mt-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setPageSize((s) => s + 8)}
              disabled={loading}
            >
              Load more
            </Button>
          </div>
        )}
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
