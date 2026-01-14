import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock3, ArrowDownRight, ArrowUpRight, Search, ChevronLeft, ChevronRight, Calendar, Loader2, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { PerplexityChatInput } from '@/components/ui/PerplexityChatInput';
import { mockWatchlist, mockWatchlistSummary } from '@/lib/mockData/mockWatchlist';
import { cn } from '@/lib/utils';
import { animateTextIntoInput } from '@/lib/utils/typewriter';
import { Input } from '@/components/ui/input';

type TabKey = 'markets' | 'earnings' | 'politicians' | 'watchlist';

const TABS: { key: TabKey; label: string; placeholder: string; chips: string[] }[] = [
  { key: 'markets', label: 'US Markets', placeholder: 'Ask anything about US markets...', chips: ["What's moving the market today?", 'Latest Fed news'] },
  { key: 'earnings', label: 'Earnings', placeholder: 'Ask anything about US company earnings...', chips: ["Find a company's earnings date", 'Upcoming tech earnings'] },
  { key: 'politicians', label: 'Politicians', placeholder: 'Ask about politician trades...', chips: ['Who traded most recently?', 'Show congressional buys'] },
  { key: 'watchlist', label: 'Watchlist', placeholder: 'Ask about your watchlist...', chips: ['Which names are up today?', 'Where is momentum strongest?'] },
];

const API_BASE_URL = 'http://localhost:8000';

interface NewsArticle {
  id?: string;
  headline?: string;
  title?: string;
  summary?: string;
  text?: string;
  publishedAt?: string;
  published_date?: string;
  source?: string;
  publisher?: string;
  url?: string;
  image?: string;
}

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface EarningsItem {
  symbol: string;
  date: string;
  company_name: string;
  eps_estimated: number | null;
  eps_actual: number | null;
  revenue_estimated: number | null;
  revenue_actual: number | null;
}

// Helper function to format relative time
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
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

// Generate calendar days for the next 30 days
function generateCalendarDays(startDate: Date, days: number = 30) {
  const result = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    result.push({
      date: date.toISOString().split('T')[0],
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      isToday: date.toDateString() === new Date().toDateString(),
    });
  }
  return result;
}

export default function Intelligence() {
  const [activeTab, setActiveTab] = useState<TabKey>('markets');
  const [openSummary, setOpenSummary] = useState<Record<number, boolean>>({});
  const [chatValue, setChatValue] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string }[]>([]);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typeIntervalRef = useRef<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [congressTrades, setCongressTrades] = useState<any[]>([]);
  const [congressLoading, setCongressLoading] = useState(false);
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earningsSearch, setEarningsSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarStartOffset, setCalendarStartOffset] = useState(0);
  const placeholderAnimRef = useRef<{ interval?: number | null; timeout?: number | null; running: boolean; idx: number }>({
    interval: null,
    timeout: null,
    running: false,
    idx: 0,
  });

  // Fetch real news from backend
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/news/general?limit=10`);
        if (res.ok) {
          const data = await res.json();
          setNews(data.slice(0, 8));
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, []);

  // Fetch market indices
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        setIndicesLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/macro/latest`);
        if (res.ok) {
          const data = await res.json();
          const indexList: MarketIndex[] = [];
          ['SPX', 'NDX', 'DJI', 'VIX'].forEach(key => {
            if (data[key]) {
              indexList.push({
                symbol: key,
                name: key === 'SPX' ? 'S&P 500' : key === 'NDX' ? 'NASDAQ' : key === 'DJI' ? 'Dow Jones' : 'VIX',
                price: data[key].value || 0,
                change: 0,
                changePercent: data[key].change_percent || 0,
              });
            }
          });
          setIndices(indexList);
        }
      } catch (err) {
        console.error('Failed to fetch indices:', err);
      } finally {
        setIndicesLoading(false);
      }
    };
    fetchIndices();
    const interval = setInterval(fetchIndices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch earnings calendar
  useEffect(() => {
    if (activeTab === 'earnings') {
      const fetchEarnings = async () => {
        try {
          setEarningsLoading(true);
          const today = new Date();
          const fromDate = today.toISOString().split('T')[0];
          const toDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const res = await fetch(`${API_BASE_URL}/api/earnings/calendar?from_date=${fromDate}&to_date=${toDate}&limit=500`);
          if (res.ok) {
            const data = await res.json();
            setEarnings(data);
          }
        } catch (err) {
          console.error('Failed to fetch earnings:', err);
        } finally {
          setEarningsLoading(false);
        }
      };
      fetchEarnings();
    }
  }, [activeTab]);

  // Fetch congressional trades when Politicians tab is active
  useEffect(() => {
    if (activeTab === 'politicians' && congressTrades.length === 0) {
      const fetchCongressTrades = async () => {
        try {
          setCongressLoading(true);
          const res = await fetch(`${API_BASE_URL}/api/congress/trades/recent?limit=50`);
          if (res.ok) {
            const data = await res.json();
            setCongressTrades(data);
          }
        } catch (err) {
          console.error('Failed to fetch congress trades:', err);
        } finally {
          setCongressLoading(false);
        }
      };
      fetchCongressTrades();
    }
  }, [activeTab, congressTrades.length]);

  const activeTabMeta = useMemo(() => TABS.find((t) => t.key === activeTab)!, [activeTab]);
  const placeholderQuestions = useMemo(() => {
    const map: Record<TabKey, string[]> = {
      markets: [
        "What's moving the market today?",
        'Latest Fed news and market impact',
        'Which sectors are outperforming?',
        "Show me today's biggest movers",
      ],
      earnings: [
        'Who reports earnings next week?',
        "Find a company's earnings date",
        "Show me this week's earnings calendar",
        'Analyze recent earnings surprises',
      ],
      politicians: [
        'Which politicians traded this week?',
        'Show me recent insider purchases',
        'Track unusual trading activity',
        'Find large undisclosed transactions',
      ],
      watchlist: [
        'Summarize my watchlist performance',
        'Find similar companies to my holdings',
        'What news affects my watchlist today?',
        'Which stocks have upcoming catalysts?',
      ],
    };
    return map[activeTab];
  }, [activeTab]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + calendarStartOffset);
    return generateCalendarDays(startDate, 14);
  }, [calendarStartOffset]);

  // Earnings by date
  const earningsByDate = useMemo(() => {
    const map: Record<string, EarningsItem[]> = {};
    earnings.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [earnings]);

  // Filtered earnings for selected date or search
  const filteredEarnings = useMemo(() => {
    let result = earnings;
    
    if (earningsSearch) {
      const searchLower = earningsSearch.toLowerCase();
      result = result.filter(e => 
        e.symbol.toLowerCase().includes(searchLower) ||
        e.company_name.toLowerCase().includes(searchLower)
      );
    } else if (selectedDate) {
      result = result.filter(e => e.date === selectedDate);
    }
    
    return result.slice(0, 50);
  }, [earnings, earningsSearch, selectedDate]);

  const stopPlaceholderAnimation = () => {
    if (placeholderAnimRef.current.interval) clearInterval(placeholderAnimRef.current.interval);
    if (placeholderAnimRef.current.timeout) clearTimeout(placeholderAnimRef.current.timeout);
    placeholderAnimRef.current.interval = null;
    placeholderAnimRef.current.timeout = null;
    placeholderAnimRef.current.running = false;
    setAnimatedPlaceholder('');
  };

  const startPlaceholderAnimation = useMemo(
    () => (questions: string[]) => {
      stopPlaceholderAnimation();
      if (!questions.length) return;
      placeholderAnimRef.current.running = true;
      placeholderAnimRef.current.idx = 0;

      const animateQuestion = (qIdx: number) => {
        if (qIdx >= questions.length) {
          placeholderAnimRef.current.running = false;
          return;
        }
        const q = questions[qIdx];
        let i = 0;
        setAnimatedPlaceholder('');
        placeholderAnimRef.current.interval = window.setInterval(() => {
          setAnimatedPlaceholder(q.slice(0, i + 1));
          i += 1;
          if (i >= q.length) {
            if (placeholderAnimRef.current.interval) {
              clearInterval(placeholderAnimRef.current.interval);
              placeholderAnimRef.current.interval = null;
            }
            placeholderAnimRef.current.timeout = window.setTimeout(() => {
              animateQuestion(qIdx + 1);
            }, 2000);
          }
        }, 50);
      };

      animateQuestion(0);
    },
    []
  );

  const handleChipClick = (text: string) => {
    if (!inputRef.current) {
      console.error('Input ref is null when triggering typewriter');
      return;
    }
    stopPlaceholderAnimation();
    setIsTyping(true);
    animateTextIntoInput(
      text,
      inputRef.current,
      setChatValue,
      typeIntervalRef,
      () => setIsTyping(false),
      50
    );
  };

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    const id = Date.now().toString();
    const userMessage = { id, role: 'user' as const, content: text.trim() };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatValue('');
    stopPlaceholderAnimation();
    setTimeout(() => {
      const aiMessage = {
        id: `${id}-ai`,
        role: 'assistant' as const,
        content: `Analyzing (${activeTabMeta.label}): ${text.trim()}. This is a mock response with quick insights.`,
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    }, 1200);
  };

  useEffect(() => {
    if (!isInputFocused && !chatValue) {
      startPlaceholderAnimation(placeholderQuestions);
    } else {
      stopPlaceholderAnimation();
    }
    return () => {
      stopPlaceholderAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isInputFocused, chatValue, startPlaceholderAnimation]);

  return (
    <div className="relative min-h-screen bg-[#0a0a0b]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-emerald-900/20 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <h1 className="text-2xl font-bold text-white mb-1">Intelligence Center</h1>
            <p className="text-sm text-zinc-400">
              AI-powered market analysis and insights
            </p>
          </div>
        </div>
      </div>
      
      {/* Top Tabs */}
      <div className="sticky top-0 z-40 px-6 py-3 bg-[#0a0a0b]/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:bg-zinc-800'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6 pb-32">
        {activeTab === 'markets' && (
          <>
            {/* Market Indices - Real Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {indicesLoading ? (
                <div className="col-span-4 flex items-center justify-center h-32 text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading indices...
                </div>
              ) : (
                indices.map((m) => {
                  const isUp = m.changePercent >= 0;
                  return (
                    <div key={m.symbol} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 hover:border-zinc-700 transition-colors">
                      <div className="flex items-center justify-between text-sm text-zinc-400 font-medium">
                        <span>{m.name}</span>
                        <span className={cn('flex items-center gap-1 font-semibold text-sm', isUp ? 'text-emerald-400' : 'text-red-400')}>
                          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {m.changePercent.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-2xl font-semibold text-white font-mono">
                        {m.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Latest News - Real Data */}
            <div className="space-y-3">
              <div className="text-lg font-semibold text-white">Latest News</div>
              {newsLoading ? (
                <div className="flex items-center justify-center h-32 text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading news...
                </div>
              ) : news.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-zinc-500">No recent news available</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {news.map((article, idx) => (
                    <a
                      key={article.url || idx}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 cursor-pointer transition-all hover:border-emerald-500/40 hover:bg-zinc-800/50 block"
                    >
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                        <Clock3 className="h-3 w-3" />
                        <span>{formatRelativeTime(article.publishedAt || article.published_date || '')}</span>
                        {(article.source || article.publisher) && (
                          <>
                            <span>·</span>
                            <span>{article.source || article.publisher}</span>
                          </>
                        )}
                      </div>
                      <div className="text-base font-semibold text-white leading-snug line-clamp-2 mb-2">
                        {article.headline || article.title}
                      </div>
                      <div className="text-sm text-zinc-400 leading-6 line-clamp-2">
                        {article.summary || article.text || ''}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-6">
            {/* Header with search */}
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">Earnings Calendar</div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search company..."
                    value={earningsSearch}
                    onChange={(e) => {
                      setEarningsSearch(e.target.value);
                      setSelectedDate(null);
                    }}
                    className="pl-9 w-48 h-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setCalendarStartOffset(prev => Math.max(prev - 7, -7))}
                    className="p-2 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => setCalendarStartOffset(0)}
                    className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-400"
                  >
                    Today
                  </button>
                  <button 
                    onClick={() => setCalendarStartOffset(prev => prev + 7)}
                    className="p-2 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800"
                  >
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            {earningsLoading ? (
              <div className="flex items-center justify-center h-32 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading earnings calendar...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const dayEarnings = earningsByDate[day.date] || [];
                    const hasEarnings = dayEarnings.length > 0;
                    const isSelected = selectedDate === day.date;
                    
                    return (
                      <div
                        key={day.date}
                        onClick={() => {
                          setSelectedDate(isSelected ? null : day.date);
                          setEarningsSearch('');
                        }}
                        className={cn(
                          'rounded-xl border p-3 bg-zinc-900 border-zinc-800 space-y-1 cursor-pointer transition-all hover:border-zinc-700',
                          hasEarnings && 'border-emerald-500/50 bg-emerald-500/5',
                          isSelected && 'ring-2 ring-emerald-500 border-emerald-500',
                          day.isToday && 'ring-1 ring-blue-500'
                        )}
                      >
                        <div className="text-[10px] text-zinc-500">{day.dayOfWeek}</div>
                        <div className="text-sm font-semibold text-white">
                          {day.month} {day.dayOfMonth}
                        </div>
                        {hasEarnings ? (
                          <div className="text-xs text-emerald-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {dayEarnings.length} {dayEarnings.length === 1 ? 'Report' : 'Reports'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-600">No Reports</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected Date Details or Search Results */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">
                      {earningsSearch 
                        ? `Search Results for "${earningsSearch}"` 
                        : selectedDate 
                          ? `Earnings on ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                          : 'All Upcoming Earnings'}
                    </div>
                    <div className="text-xs text-zinc-500">{filteredEarnings.length} companies</div>
                  </div>
                  
                  {filteredEarnings.length === 0 ? (
                    <div className="text-sm text-zinc-500 text-center py-10">No earnings found</div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-zinc-800/50 sticky top-0">
                          <tr className="text-xs text-zinc-500">
                            <th className="text-left px-4 py-2 font-medium">Symbol</th>
                            <th className="text-left px-4 py-2 font-medium">Company</th>
                            <th className="text-left px-4 py-2 font-medium">Date</th>
                            <th className="text-right px-4 py-2 font-medium">Est. EPS</th>
                            <th className="text-right px-4 py-2 font-medium">Est. Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEarnings.map((item, idx) => (
                            <tr key={`${item.symbol}-${item.date}-${idx}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                              <td className="px-4 py-3">
                                <span className="font-mono font-semibold text-white">{item.symbol}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-zinc-400 max-w-[200px] truncate">
                                {item.company_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-zinc-400">
                                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm text-zinc-300">
                                {item.eps_estimated !== null ? `$${item.eps_estimated.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm text-zinc-300">
                                {item.revenue_estimated !== null 
                                  ? `$${(item.revenue_estimated / 1e9).toFixed(2)}B`
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Quick chips */}
            <div className="flex flex-wrap gap-2">
              {TABS.find((t) => t.key === 'earnings')?.chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  disabled={isTyping}
                  className="px-4 py-2 rounded-full text-[13px] text-zinc-400 border border-zinc-800 bg-zinc-900 hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'politicians' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">Congressional Trading Activity</div>
              <div className="text-sm text-zinc-500">{congressTrades.length} recent trades</div>
            </div>
            
            {congressLoading ? (
              <div className="flex items-center justify-center h-64 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading congressional trades...
              </div>
            ) : congressTrades.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-zinc-500">No recent trades available</div>
            ) : (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-900">
                      <tr className="text-xs text-zinc-500">
                        <th className="text-left px-4 py-3 font-medium">Politician</th>
                        <th className="text-left px-4 py-3 font-medium">Symbol</th>
                        <th className="text-left px-4 py-3 font-medium">Type</th>
                        <th className="text-left px-4 py-3 font-medium">Amount</th>
                        <th className="text-left px-4 py-3 font-medium">Transaction</th>
                        <th className="text-left px-4 py-3 font-medium">Disclosed</th>
                        <th className="text-left px-4 py-3 font-medium">Delay</th>
                        <th className="text-right px-4 py-3 font-medium">Filing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {congressTrades.map((trade, idx) => {
                        const isBuy = trade.type?.toLowerCase().includes('purchase') || trade.type?.toLowerCase().includes('buy');
                        const discrepancyDays = trade.disclosureDate && trade.transactionDate
                          ? Math.floor((new Date(trade.disclosureDate).getTime() - new Date(trade.transactionDate).getTime()) / (1000 * 60 * 60 * 24))
                          : null;

                        return (
                          <tr
                            key={`${trade.symbol}-${trade.disclosureDate}-${idx}`}
                            className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-white text-sm">
                                {trade.firstName} {trade.lastName}
                              </div>
                              <div className="text-xs text-zinc-500">{trade.district || trade.office}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-sm text-white">{trade.symbol}</div>
                              <div className="text-xs text-zinc-500 truncate max-w-[120px]">{trade.assetDescription}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1',
                                isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                              )}>
                                {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {trade.type?.replace('(Full)', '').replace('(Partial)', '').trim()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-zinc-300">
                              {trade.amount || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-400">
                              {trade.transactionDate || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-400">
                              {trade.disclosureDate || '-'}
                            </td>
                            <td className="px-4 py-3">
                              {discrepancyDays !== null && discrepancyDays > 0 && (
                                <span className={cn(
                                  'text-xs px-2 py-1 rounded-full',
                                  discrepancyDays > 30 
                                    ? 'bg-red-500/20 text-red-400' 
                                    : discrepancyDays > 14 
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-zinc-700 text-zinc-400'
                                )}>
                                  +{discrepancyDays}d
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {trade.link && (
                                <a
                                  href={trade.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-base font-semibold text-white mb-3">Watchlist Summary</div>
              <p className="text-sm text-zinc-400 leading-7 whitespace-pre-line">
                {mockWatchlistSummary}
              </p>
              <div className="text-[11px] text-zinc-500 text-right mt-3">Updated 7 minutes ago</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="grid grid-cols-6 text-xs text-zinc-500 px-4 py-3 border-b border-zinc-800">
                <div className="col-span-2">Name</div>
                <div>Price</div>
                <div>1D</div>
                <div>5D</div>
                <div>1M</div>
              </div>
              {mockWatchlist.map((s) => (
                <div key={s.ticker} className="grid grid-cols-6 px-4 py-3 items-center text-sm border-b border-zinc-800 hover:bg-zinc-800/30">
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-zinc-800" />
                    <div>
                      <div className="text-sm font-semibold text-white">{s.name}</div>
                      <div className="text-xs text-zinc-500">{s.ticker}</div>
                    </div>
                  </div>
                  <div className="font-mono text-white">{s.price.toFixed(2)}</div>
                  <div className={cn('font-mono', s.change1D >= 0 ? 'text-emerald-400' : 'text-red-400')}>{s.change1D.toFixed(2)}%</div>
                  <div className={cn('font-mono', s.change5D >= 0 ? 'text-emerald-400' : 'text-red-400')}>{s.change5D.toFixed(2)}%</div>
                  <div className={cn('font-mono', s.change1M >= 0 ? 'text-emerald-400' : 'text-red-400')}>{s.change1M.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Chat Input */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[800px] px-6">
        <PerplexityChatInput
          value={chatValue}
          onValueChange={setChatValue}
          onSubmit={handleSubmit}
          disabled={isTyping}
          defaultModel="gemini-flash"
          inputRef={inputRef}
          animatedPlaceholder={animatedPlaceholder}
          onInputFocus={() => {
            setIsInputFocused(true);
            stopPlaceholderAnimation();
          }}
          onInputBlur={() => {
            setIsInputFocused(false);
          }}
        />
      </div>
    </div>
  );
}
