import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export function StandoutsCard() {
  const navigate = useNavigate();
  const [standouts, setStandouts] = useState<any[]>([]);

  useEffect(() => {
    const fetchStandouts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/market/standouts?limit=10`);
        const data = await res.json();
        const combined = [
          ...(data.gainers || []),
          ...(data.losers || []),
          ...(data.actives || []),
        ].slice(0, 10);

        // Fetch intraday chart data for each stock
        const standoutsWithCharts = await Promise.all(
          combined.map(async (s: any) => {
            try {
              const chartRes = await fetch(
                `${API_BASE_URL}/api/stock/${encodeURIComponent(s.ticker)}/chart?timeframe=5min&limit=78`
              );
              const chartData = await chartRes.json();

              // Only use today's data
              const today = new Date().toISOString().split('T')[0];
              const todayData = chartData.filter((bar: any) =>
                bar.date && bar.date.startsWith(today)
              );

              // If no today data (market closed), use most recent 78 bars (1 trading day at 5min)
              const chartBars = todayData.length > 0 ? todayData : chartData.slice(-78);

              return {
                ...s,
                tags: ['Mover'],
                sparklineData: chartBars.map((bar: any) => ({ close: bar.close })),
              };
            } catch (error) {
              console.error(`Error fetching chart for ${s.ticker}:`, error);
              return {
                ...s,
                tags: ['Mover'],
                sparklineData: [],
              };
            }
          })
        );

        setStandouts(standoutsWithCharts);
      } catch (err) {
        console.error('Error fetching standouts', err);
        setStandouts([]);
      }
    };
    fetchStandouts();

    // Refresh every 5 minutes during market hours
    const interval = setInterval(fetchStandouts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAskWhy = () => {
    const prompt = "Analyze why these standout names might be mispriced and how they fit in a quality growth portfolio.";
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  const getTagColor = (tag: string) => {
    if (tag.includes('High') || tag.includes('Beat')) return 'bg-positive/20 text-positive border-positive/30';
    if (tag.includes('Insider')) return 'bg-warning/20 text-warning border-warning/30';
    if (tag.includes('Upgrade') || tag.includes('Growth')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (tag.includes('Momentum') || tag.includes('Breakout')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (tag.includes('Dividend')) return 'bg-positive/20 text-positive border-positive/30';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="bg-sidebar-accent rounded-xl p-6 border border-border h-full">
      <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-page-heading)' }}>Notable Standouts</h2>
      <div className="space-y-3">
        {standouts.slice(0, 5).map((stock) => (
          <div
            key={stock.ticker}
            className="flex items-start justify-between gap-3 py-2 px-2 -mx-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted transition-colors duration-200 cursor-pointer"
          >
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sm">{stock.ticker}</span>
                <span className="text-xs text-muted-foreground truncate">{stock.name}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {stock.tags.map((tag: string) => (
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
            {stock.sparklineData && stock.sparklineData.length > 0 && (
              <div className="w-20 h-10 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stock.sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke={
                        (stock.change1D ?? stock.change_percent ?? 0) >= 0
                          ? 'hsl(var(--positive))'
                          : 'hsl(var(--negative))'
                      }
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
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
      </div>
    </div>
  );
}
