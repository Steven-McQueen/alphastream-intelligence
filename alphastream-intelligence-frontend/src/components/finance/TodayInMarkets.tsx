import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTodaySummary, getSectorTiles } from '@/data/mockFinanceHome';
import { useMarket } from '@/context/MarketContext';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export function TodayInMarkets() {
  const navigate = useNavigate();
  const summary = getTodaySummary();
  const sectors = getSectorTiles();
  const { marketState } = useMarket();

  // Generate SPX 5-day data
  const spxData = Array.from({ length: 5 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
    value: 5850 + Math.random() * 100,
  }));
  spxData[4].value = marketState.indices.find(i => i.symbol === 'SPX')?.value || 5892;

  const handleDigDeeper = () => {
    navigate('/intelligence?q=' + encodeURIComponent("Give me a detailed recap of today's US market moves."));
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Today in Markets</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{summary.date}</span>
            <Select defaultValue="us" disabled>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="us">US</SelectItem>
                <SelectItem value="global" disabled>Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Narrative */}
          <div className="space-y-4">
            <ul className="space-y-2.5">
              {summary.narrative.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-1">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="link"
              className="p-0 h-auto text-primary text-sm"
              onClick={handleDigDeeper}
            >
              Ask for full market recap
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          {/* Right: Chart & Sector Strip */}
          <div className="space-y-4">
            {/* SPX Chart */}
            <div className="h-24 bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">S&P 500 (5D)</div>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={spxData}>
                  <XAxis dataKey="day" hide />
                  <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sector Heat Strip */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Sector Performance (1D)</div>
              <div className="flex gap-0.5 h-6 rounded overflow-hidden">
                {sectors.slice(0, 11).map((sector) => {
                  const intensity = Math.min(Math.abs(sector.change1D) / 3, 1);
                  const bgColor = sector.change1D >= 0
                    ? `rgba(34, 197, 94, ${0.2 + intensity * 0.6})`
                    : `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`;
                  
                  return (
                    <div
                      key={sector.sector}
                      className="flex-1 flex items-center justify-center text-[8px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: bgColor }}
                      title={`${sector.sector}: ${sector.change1D >= 0 ? '+' : ''}${sector.change1D.toFixed(2)}%`}
                    >
                      <span className="truncate px-0.5 text-foreground">
                        {sector.sector.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
