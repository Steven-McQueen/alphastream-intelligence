import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMarket } from '@/context/MarketContext';
import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine,
  BarChart, Bar
} from 'recharts';
import { cn } from '@/lib/utils';
import { IndexChat } from '@/components/market/IndexChat';

const API_BASE_URL = 'http://localhost:8000';

type TimeRange = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y';
type NavTab = 'Overview' | 'Historical Data' | 'News';

interface IntradayPoint {
  time: string;
  date?: string;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

interface IndexQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
  volume: number;
  avgVolume: number;
}

interface NewsArticle {
  id: string;
  headline: string;
  title?: string;
  summary: string;
  text?: string;
  source: string;
  publisher?: string;
  publishedAt: string;
  publishedDate?: string;
  url?: string;
  image?: string;
}

interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Index name mapping
const INDEX_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ Composite',
  '^DJI': 'Dow Jones Industrial Average',
  '^RUT': 'Russell 2000',
  '^VIX': 'CBOE Volatility Index',
  'GSPC': 'S&P 500',
  'IXIC': 'NASDAQ Composite',
  'DJI': 'Dow Jones Industrial Average',
  'RUT': 'Russell 2000',
  'VIX': 'CBOE Volatility Index',
};

// Days for each timeframe
const TIMEFRAME_DAYS: Record<TimeRange, number> = {
  '1D': 1,
  '5D': 5,
  '1M': 30,
  '6M': 180,
  'YTD': 365,
  '1Y': 365,
  '5Y': 1825,
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
}

function formatDate(dateStr: string, isIntraday: boolean): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isIntraday) {
      return date.toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
      });
    }
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function IndexDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { indices } = useMarket();
  const [activeTab, setActiveTab] = useState<NavTab>('Overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');
  const [quote, setQuote] = useState<IndexQuote | null>(null);
  const [chartData, setChartData] = useState<IntradayPoint[]>([]);
  const [historicalData, setHistoricalData] = useState<PriceBar[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;

  // Normalize symbol
  const normalizedSymbol = useMemo(() => {
    if (!symbol) return '';
    return symbol.startsWith('^') ? symbol : `^${symbol}`;
  }, [symbol]);

  const displaySymbol = useMemo(() => {
    if (!symbol) return '';
    return symbol.replace('^', '');
  }, [symbol]);

  // Get fallback index data from context
  const contextIndex = useMemo(() =>
    indices.find(i => i.symbol === displaySymbol || i.symbol === normalizedSymbol),
    [indices, displaySymbol, normalizedSymbol]
  );

  // Fetch index quote
  useEffect(() => {
    const fetchQuote = async () => {
      if (!normalizedSymbol) return;
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/index/${encodeURIComponent(normalizedSymbol)}/quote`);
        if (res.ok) {
          const data = await res.json();
          setQuote(data);
        }
      } catch (err) {
        console.error('Error fetching index quote:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
    const interval = setInterval(fetchQuote, 30000);
    return () => clearInterval(interval);
  }, [normalizedSymbol]);

  // Fetch chart data based on timeRange
  const fetchChartData = useCallback(async () => {
    if (!normalizedSymbol) return;
    setChartLoading(true);
    try {
      const isIntraday = timeRange === '1D' || timeRange === '5D';
      const timeframe = isIntraday ? '5min' : '1day';
      const limit = isIntraday ? (timeRange === '1D' ? 78 : 390) : TIMEFRAME_DAYS[timeRange];

      const res = await fetch(
        `${API_BASE_URL}/api/index/${encodeURIComponent(normalizedSymbol)}/chart?timeframe=${timeframe}&limit=${limit}`
      );

      if (res.ok) {
        const data = await res.json();

        if (isIntraday) {
          // Filter to latest trading day(s)
          let filtered = data;
          if (data && data.length > 0 && timeRange === '1D') {
            const latestDate = data[0]?.date?.split(' ')[0] || data[0]?.date?.split('T')[0];
            filtered = data.filter((bar: any) => {
              const barDate = bar.date?.split(' ')[0] || bar.date?.split('T')[0];
              return barDate === latestDate;
            });
            if (filtered.length < 10) filtered = data.slice(0, 78);
          }

          const points: IntradayPoint[] = filtered.map((bar: any) => ({
            time: bar.date?.split(' ')[1]?.substring(0, 5) || bar.date,
            date: bar.date,
            value: bar.close,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
          })).reverse();
          setChartData(points);
          setHistoricalData(filtered.reverse());
        } else {
          // Daily data
          const points: IntradayPoint[] = data.map((bar: any) => ({
            time: bar.date,
            date: bar.date,
            value: bar.close,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
          })).reverse();
          setChartData(points);
          setHistoricalData(data.reverse());
        }
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
    } finally {
      setChartLoading(false);
    }
  }, [normalizedSymbol, timeRange]);

  useEffect(() => {
    fetchChartData();
    const interval = setInterval(fetchChartData, timeRange === '1D' ? 5 * 60 * 1000 : 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchChartData, timeRange]);

  // Fetch news
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/news/general?limit=20`);
        if (res.ok) {
          const data = await res.json();
          setNews(data);
        }
      } catch (err) {
        console.error('Error fetching news:', err);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, []);

  // Build display data
  const indexName = INDEX_NAMES[normalizedSymbol] || INDEX_NAMES[displaySymbol] || quote?.name || contextIndex?.name || displaySymbol;
  const currentValue = quote?.price || contextIndex?.value || 0;
  const change = quote?.change || contextIndex?.change || 0;
  const changePercent = quote?.changePercent || contextIndex?.changePercent || 0;
  const prevClose = quote?.previousClose || (currentValue - change) || 0;
  const isPositive = changePercent >= 0;

  // Paginated historical data
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return historicalData.slice(start, start + pageSize);
  }, [historicalData, currentPage, pageSize]);

  const totalPages = Math.ceil(historicalData.length / pageSize);

  // Export CSV
  const handleExportCSV = () => {
    if (historicalData.length === 0) return;
    const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'];
    const rows = historicalData.map(bar => [
      bar.date, bar.open?.toFixed(2), bar.high?.toFixed(2), bar.low?.toFixed(2), bar.close?.toFixed(2), bar.volume
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displaySymbol}_historical_${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !contextIndex) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-zinc-400">Loading index data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-2 border-b border-border bg-background">
        <Button variant="ghost" size="sm" onClick={() => navigate('/market')} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Market
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{indexName}</h1>
              <Badge variant="outline" className="text-xs">{normalizedSymbol} · INDEX</Badge>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-mono font-semibold text-foreground">
                {currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={cn('flex items-center gap-1 text-lg font-medium', isPositive ? 'text-positive' : 'text-negative')}>
                {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {change >= 0 ? '+' : ''}{change.toFixed(2)}
                <span className="text-base">({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} EST
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 mt-4 border-b border-border">
          {(['Overview', 'Historical Data', 'News'] as NavTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {activeTab === 'Overview' && (
            <>
              {/* Chart Section */}
              <Card className="p-4 bg-card border-border">
                <div className="flex items-center justify-between mb-4">
                  <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                    <TabsList className="bg-muted/50">
                      {(['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y'] as TimeRange[]).map((range) => (
                        <TabsTrigger key={range} value={range} className="text-xs px-3">{range}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <div className="text-sm text-muted-foreground">
                    Prev close: <span className="font-mono text-foreground">{prevClose.toFixed(2)}</span>
                  </div>
                </div>

                <div className="h-[300px]">
                  {chartLoading ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />Loading chart...
                    </div>
                  ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(val) => val.toLocaleString()} width={60} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [value.toLocaleString(undefined, { minimumFractionDigits: 2 }), 'Value']} />
                        <ReferenceLine y={prevClose} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Area type="monotone" dataKey="value" stroke={isPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'} strokeWidth={2} fill="url(#chartGradient)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </div>

                {/* Key Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                  <div><div className="text-sm text-muted-foreground">Prev Close</div><div className="text-lg font-mono font-medium">{prevClose.toFixed(2)}</div></div>
                  <div><div className="text-sm text-muted-foreground">52W Range</div><div className="text-lg font-mono font-medium">{quote?.yearLow?.toFixed(2) || '-'} - {quote?.yearHigh?.toFixed(2) || '-'}</div></div>
                  <div><div className="text-sm text-muted-foreground">Open</div><div className="text-lg font-mono font-medium">{quote?.open?.toFixed(2) || '-'}</div></div>
                  <div><div className="text-sm text-muted-foreground">Day Range</div><div className="text-lg font-mono font-medium">{quote?.dayLow?.toFixed(2) || '-'} - {quote?.dayHigh?.toFixed(2) || '-'}</div></div>
                  <div><div className="text-sm text-muted-foreground">Volume</div><div className="text-lg font-mono font-medium">{quote?.volume ? formatVolume(quote.volume) : '-'}</div></div>
                  <div><div className="text-sm text-muted-foreground">Avg Volume</div><div className="text-lg font-mono font-medium">{quote?.avgVolume ? formatVolume(quote.avgVolume) : '-'}</div></div>
                  <div><div className="text-sm text-muted-foreground">Day Change</div><div className={cn('text-lg font-mono font-medium', isPositive ? 'text-positive' : 'text-negative')}>{change >= 0 ? '+' : ''}{change.toFixed(2)}</div></div>
                  <div><div className="text-sm text-muted-foreground">Change %</div><div className={cn('text-lg font-mono font-medium', isPositive ? 'text-positive' : 'text-negative')}>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</div></div>
                </div>
              </Card>

              {/* AI Chat */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <IndexChat indexName={indexName} indexSymbol={displaySymbol} />
              </div>
            </>
          )}

          {activeTab === 'Historical Data' && (
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Historical Data</h3>
                  <p className="text-sm text-muted-foreground">
                    {timeRange === '1D' || timeRange === '5D' ? '5 minute interval' : 'Daily interval'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tabs value={timeRange} onValueChange={(v) => { setTimeRange(v as TimeRange); setCurrentPage(0); }}>
                    <TabsList className="bg-muted/50">
                      {(['1D', '5D', '1M', '6M', '1Y', '5Y'] as TimeRange[]).map((range) => (
                        <TabsTrigger key={range} value={range} className="text-xs px-3">{range}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={historicalData.length === 0}>
                    <Download className="w-4 h-4 mr-1" /> Export
                  </Button>
                </div>
              </div>

              {/* Volume Chart */}
              <div className="h-24 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-50)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Bar dataKey="volume" fill="hsl(var(--muted-foreground))" opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              {chartLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
                          <th className="text-right py-3 px-2 text-muted-foreground font-medium">Open</th>
                          <th className="text-right py-3 px-2 text-muted-foreground font-medium">High</th>
                          <th className="text-right py-3 px-2 text-muted-foreground font-medium">Low</th>
                          <th className="text-right py-3 px-2 text-muted-foreground font-medium">Close</th>
                          <th className="text-right py-3 px-2 text-muted-foreground font-medium">Change</th>
                          <th className="text-right py-3 px-2 text-muted-foreground font-medium">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((bar, idx) => {
                          const prevBar = historicalData[currentPage * pageSize + idx + 1];
                          const dayChange = prevBar ? ((bar.close - prevBar.close) / prevBar.close) * 100 : 0;
                          const dayChangePositive = dayChange >= 0;
                          return (
                            <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-3 px-2 font-mono text-foreground">{formatDate(bar.date, timeRange === '1D' || timeRange === '5D')}</td>
                              <td className="py-3 px-2 text-right font-mono text-foreground">{formatPrice(bar.open)}</td>
                              <td className="py-3 px-2 text-right font-mono text-foreground">{formatPrice(bar.high)}</td>
                              <td className="py-3 px-2 text-right font-mono text-foreground">{formatPrice(bar.low)}</td>
                              <td className="py-3 px-2 text-right font-mono text-foreground">{formatPrice(bar.close)}</td>
                              <td className={cn('py-3 px-2 text-right font-mono', dayChangePositive ? 'text-positive' : 'text-negative')}>
                                {dayChange !== 0 ? `${dayChangePositive ? '+' : ''}${dayChange.toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-3 px-2 text-right font-mono text-muted-foreground">{formatVolume(bar.volume)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage + 1} of {totalPages} ({historicalData.length} records)
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {activeTab === 'News' && (
            <Card className="p-4 bg-card border-border">
              <h3 className="text-lg font-semibold mb-4">Market News</h3>
              {newsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : news.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No news available</div>
              ) : (
                <div className="space-y-4">
                  {news.map((article, idx) => (
                    <a
                      key={article.id || idx}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        {article.image && (
                          <img src={article.image} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-1">{article.headline || article.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{article.summary || article.text}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{article.source || article.publisher}</span>
                            <span>·</span>
                            <span>{formatTimeAgo(article.publishedAt || article.publishedDate || '')}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
