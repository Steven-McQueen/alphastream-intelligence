import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { API_BASE_URL } from '@/config/api';

// Index name mappings
const indexNames: Record<string, string> = {
  'GSPC': 'S&P 500',
  'IXIC': 'NASDAQ',
  'DJI': 'Dow Jones',
  'RUT': 'Russell 2000',
  'VIX': 'VIX',
};

interface IndexData {
  symbol: string;
  name: string;
  value: number;
  changePercent: number;
  changePoints: number;
  chartData: { close: number }[];
}


export function IndicesMacroCard() {
  const navigate = useNavigate();
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Define index symbols to fetch
        const indexSymbols = ['^GSPC', '^IXIC', '^DJI', '^RUT'];

        // Fetch current values for all indices
        const indicesResponse = await fetch('${API_BASE_URL}/api/macro/latest');
        let indicesData: Record<string, any> = {};
        try {
          const data = await indicesResponse.json();
          if (data && !data.detail) {
            indicesData = data;
          }
        } catch {
          console.warn('Could not parse indices data');
        }

        // Fetch intraday chart data using the working batch endpoint
        const chartResponse = await fetch(
          `${API_BASE_URL}/api/market/indices/intraday?symbols=${indexSymbols.map(s => encodeURIComponent(s)).join(',')}&interval=5min`
        );
        let chartDataBySymbol: Record<string, any[]> = {};
        try {
          const data = await chartResponse.json();
          if (data && !data.detail) {
            chartDataBySymbol = data;
          }
        } catch {
          console.warn('Could not parse chart data');
        }

        // Process each index
        const indicesWithCharts = indexSymbols.map((symbol) => {
          const indexKey = symbol.replace('^', '');
          const currentData = indicesData[indexKey];
          const chartData = chartDataBySymbol[symbol] || [];

          // Get chart data - prefer today's data, fallback to last trading day
          let chartBars: any[] = [];

          if (chartData && chartData.length > 0) {
            // Find the most recent date in the data
            const latestDate = chartData[0]?.date?.split(' ')[0] || chartData[0]?.date?.split('T')[0];

            if (latestDate) {
              // Filter to only that day's data
              const dayData = chartData.filter((bar: any) => {
                const barDate = bar.date?.split(' ')[0] || bar.date?.split('T')[0];
                return barDate === latestDate;
              });

              // Use day data if available, otherwise use last 78 bars
              chartBars = dayData.length > 10 ? dayData : chartData.slice(0, 78);
            } else {
              chartBars = chartData.slice(0, 78);
            }

            // Reverse to show chronologically (oldest to newest for chart)
            chartBars = [...chartBars].reverse();
          }

          // Calculate point change from first and last chart values
          const firstValue = chartBars.length > 0 ? chartBars[0].value : 0;
          const lastValue = chartBars.length > 0 ? chartBars[chartBars.length - 1].value : currentData?.value || 0;
          const pointChange = lastValue - firstValue;

          return {
            symbol: indexKey,
            name: indexNames[indexKey] || indexKey,
            value: currentData?.value || lastValue || 0,
            changePercent: currentData?.change_percent || 0,
            changePoints: pointChange,
            chartData: chartBars.map((bar: any) => ({ close: bar.value || bar.close })),
          };
        });

        setIndices(indicesWithCharts.filter((idx): idx is IndexData => idx !== null && idx.value > 0));
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching indices/macro data:', error);
        setIsLoading(false);
      }
    };

    fetchData();

    // Refresh every 5 minutes during market hours
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card className="bg-sidebar-accent border-border h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-widget-heading)' }}>Indices</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-4 border border-border/50 animate-[pf-shimmer_2s_ease-in-out_infinite]">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded mb-3" />
                <div className="h-16 bg-muted rounded mb-2" />
                <div className="h-6 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-sidebar-accent border-border h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-widget-heading)' }}>Indices</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          {indices.map((index) => {
            const isPositive = index.changePercent >= 0;
            return (
              <Card
                key={index.symbol}
                className="p-4 bg-card border-border overflow-hidden cursor-pointer hover:bg-muted transition-all duration-200"
                onClick={() => navigate(`/market/${encodeURIComponent('^' + index.symbol)}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-base text-foreground">{index.name}</div>
                    <div className="text-xs text-muted-foreground">^{index.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        'text-xs font-mono px-2 py-1 rounded',
                        isPositive ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'
                      )}
                    >
                      {isPositive ? '↗' : '↘'} {Math.abs(index.changePercent).toFixed(2)}%
                    </div>
                    <div
                      className={cn(
                        'text-xs font-mono mt-1',
                        isPositive ? 'text-positive' : 'text-negative'
                      )}
                    >
                      {index.changePoints >= 0 ? '+' : ''}{index.changePoints.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Sparkline Chart with Gradient */}
                <div className="h-16 -mx-2 my-2">
                  {index.chartData.length > 0 ? (() => {
                    const values = index.chartData.map(d => d.close);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const range = max - min;
                    const padding = range > 0 ? range * 0.1 : max * 0.001;
                    const yMin = min - padding;
                    const yMax = max + padding;

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={index.chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`gradient-${index.symbol}`} x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="0%"
                                stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                                stopOpacity={0.18}
                              />
                              <stop
                                offset="100%"
                                stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <YAxis domain={[yMin, yMax]} hide />
                          <Area
                            type="monotone"
                            dataKey="close"
                            stroke={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            fill={`url(#gradient-${index.symbol})`}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    );
                  })() : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                      Loading...
                    </div>
                  )}
                </div>

                {/* Current Value */}
                <div className="font-mono text-2xl font-semibold text-foreground">
                  {index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
