import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { useMarket } from '@/context/MarketContext';
import { getIndexIntradayData, getIndexDetailData, getIndexNews } from '@/data/mockMarket';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import { IndexChat } from '@/components/market/IndexChat';
import { IndexNewsFeed } from '@/components/market/IndexNewsFeed';

type TimeRange = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';

export default function IndexDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { indices } = useMarket();
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');

  const index = useMemo(() => 
    indices.find(i => i.symbol === symbol), 
    [indices, symbol]
  );

  const intradayData = useMemo(() => 
    symbol ? getIndexIntradayData(symbol) : [], 
    [symbol]
  );

  const detailData = useMemo(() => 
    symbol ? getIndexDetailData(symbol) : null, 
    [symbol]
  );

  const relatedNews = useMemo(() => 
    symbol ? getIndexNews(symbol) : [], 
    [symbol]
  );

  if (!index || !detailData) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/market')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Market
        </Button>
        <div className="text-center py-12 text-muted-foreground">
          Index not found
        </div>
      </div>
    );
  }

  const isPositive = index.changePercent >= 0;
  const prevClose = detailData.previousClose;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-2 border-b border-border bg-background">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/market')}
          className="mb-3 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Market
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{index.name}</h1>
              <Badge variant="outline" className="text-xs">
                ^{index.symbol} · INDEX
              </Badge>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-mono font-semibold text-foreground">
                {index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={cn(
                'flex items-center gap-1 text-lg font-medium',
                isPositive ? 'text-positive' : 'text-negative'
              )}>
                {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}
                <span className="text-base">
                  ({isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%)
                </span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              At Close: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 4:00:00 PM EST
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Chart Section */}
          <Card className="p-4 bg-card border-border">
            {/* Time Range Tabs */}
            <div className="flex items-center justify-between mb-4">
              <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <TabsList className="bg-muted/50">
                  {(['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'] as TimeRange[]).map((range) => (
                    <TabsTrigger 
                      key={range} 
                      value={range}
                      className="text-xs px-3"
                    >
                      {range}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="text-sm text-muted-foreground">
                Prev close: <span className="font-mono text-foreground">{prevClose.toFixed(2)}</span>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={intradayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(val) => val.toLocaleString()}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    formatter={(value: number) => [value.toLocaleString(undefined, { minimumFractionDigits: 2 }), 'Value']}
                  />
                  <ReferenceLine 
                    y={prevClose} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                    strokeWidth={2}
                    fill="url(#chartGradient)"
                    dot={false}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <div className="text-sm text-muted-foreground">Prev Close</div>
                <div className="text-lg font-mono font-medium text-foreground">{prevClose.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">52W Range</div>
                <div className="text-lg font-mono font-medium text-foreground">
                  {detailData.low52w.toFixed(2)} - {detailData.high52w.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Open</div>
                <div className="text-lg font-mono font-medium text-foreground">{detailData.open.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Day Range</div>
                <div className="text-lg font-mono font-medium text-foreground">
                  {detailData.dayLow.toFixed(2)} - {detailData.dayHigh.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Volume</div>
                <div className="text-lg font-mono font-medium text-foreground">
                  {detailData.volume.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Avg Volume</div>
                <div className="text-lg font-mono font-medium text-foreground">
                  {detailData.avgVolume.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">YTD Return</div>
                <div className={cn(
                  'text-lg font-mono font-medium',
                  detailData.ytdReturn >= 0 ? 'text-positive' : 'text-negative'
                )}>
                  {detailData.ytdReturn >= 0 ? '+' : ''}{detailData.ytdReturn.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">1Y Return</div>
                <div className={cn(
                  'text-lg font-mono font-medium',
                  detailData.return1y >= 0 ? 'text-positive' : 'text-negative'
                )}>
                  {detailData.return1y >= 0 ? '+' : ''}{detailData.return1y.toFixed(2)}%
                </div>
              </div>
            </div>
          </Card>

          {/* Two Column Layout: News + Chat */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Related News */}
            <IndexNewsFeed news={relatedNews} indexName={index.name} />

            {/* AI Chat */}
            <IndexChat indexName={index.name} indexSymbol={index.symbol} />
          </div>
        </div>
      </div>
    </div>
  );
}
