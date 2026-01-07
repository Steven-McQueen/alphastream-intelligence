import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock3, ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';
import { PerplexityChatInput } from '@/components/ui/PerplexityChatInput';
import { mockMarkets } from '@/lib/mockData/mockMarkets';
import { mockEarningsWeek } from '@/lib/mockData/mockEarnings';
import { mockPoliticians } from '@/lib/mockData/mockPoliticians';
import { mockWatchlist, mockWatchlistSummary } from '@/lib/mockData/mockWatchlist';
import { cn } from '@/lib/utils';
import { animateTextIntoInput } from '@/lib/utils/typewriter';

type TabKey = 'markets' | 'earnings' | 'politicians' | 'watchlist';

const TABS: { key: TabKey; label: string; placeholder: string; chips: string[] }[] = [
  { key: 'markets', label: 'US Markets', placeholder: 'Ask anything about US markets...', chips: ["What's moving the market today?", 'Latest Fed news'] },
  { key: 'earnings', label: 'Earnings', placeholder: 'Ask anything about US company earnings...', chips: ["Find a company's earnings date", 'Upcoming tech earnings'] },
  { key: 'politicians', label: 'Politicians', placeholder: 'Ask about politician trades...', chips: ['Who traded most recently?', 'Show congressional buys'] },
  { key: 'watchlist', label: 'Watchlist', placeholder: 'Ask about your watchlist...', chips: ['Which names are up today?', 'Where is momentum strongest?'] },
];

const RECENT_DEVS = [
  { title: 'S&P 500 Declines Fourth Consecutive Session', time: '2 hours ago', summary: 'U.S. stocks closed lower Wednesday as all eleven sectors traded mixed and breadth stayed weak.' },
  { title: 'Tech Megacaps Hold Gains Amid Yield Stabilization', time: '3 hours ago', summary: 'Large-cap tech managed modest strength even as cyclicals lagged and defensives outperformed.' },
  { title: 'Crude Slides on Inventory Build', time: '5 hours ago', summary: 'WTI fell after a larger-than-expected inventory build, weighing on energy equities and services.' },
];

const MARKET_SUMMARY = [
  {
    title: 'Bitcoin Posts Modest Gain Amid Ongoing Volatility',
    body: 'Bitcoin is at $88,176.08, up 0.76% on January 1, 2026, as it attempts to recover from a challenging month marked by elevated volatility and shifting macro narratives.',
  },
  {
    title: 'Treasuries Mixed as Curve Flattens',
    body: 'Long-end yields firmed while the front-end eased, suggesting continued debate on the Fed’s path and soft landing odds.',
  },
  {
    title: 'Credit Spreads Tighten Slightly',
    body: 'IG spreads tightened 2bps while HY outperformed, reflecting tentative risk appetite despite equities softness.',
  },
];

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
  const placeholderAnimRef = useRef<{ interval?: number | null; timeout?: number | null; running: boolean; idx: number }>({
    interval: null,
    timeout: null,
    running: false,
    idx: 0,
  });

  const activeTabMeta = useMemo(() => TABS.find((t) => t.key === activeTab)!, [activeTab]);
  const placeholderQuestions = useMemo(() => {
    const map: Record<TabKey, string[]> = {
      markets: [
        "What's moving the market today?",
        'Latest Fed news and market impact',
        'Which sectors are outperforming?',
        "Show me today’s biggest movers",
      ],
      earnings: [
        'Who reports earnings next week?',
        "Find a company’s earnings date",
        "Show me this week’s earnings calendar",
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
    <div className="relative min-h-screen bg-[#0a0a0a]">
      {/* Top Tabs */}
      <div className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-colors border',
                  active
                    ? 'bg-[rgba(32,184,134,0.12)] text-[#20b886] border-[rgba(32,184,134,0.3)]'
                    : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div />
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6 pb-32">
        {activeTab === 'markets' && (
          <>
            {/* Market Indices */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockMarkets.map((m) => {
                const isUp = m.changePercent >= 0;
                const points = m.sparkline
                  .map((v, i) => `${(i / (m.sparkline.length - 1)) * 100},${50 - (v - m.sparkline[0])}`)
                  .join(' ');
                return (
                  <div key={m.ticker} className="rounded-[12px] border border-[#27272a] bg-[#1a1a1a] p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm text-zinc-400 font-medium">
                      <span>{m.name}</span>
                      <span className={cn('flex items-center gap-1 font-semibold text-sm', isUp ? 'text-[#20b886]' : 'text-[#ef4444]')}>
                        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {m.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-semibold text-white font-mono">{m.price.toLocaleString()}</div>
                      <div className="text-xs text-zinc-500">{m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}</div>
                    </div>
                    <svg viewBox="0 0 100 50" className={cn('w-full h-10', isUp ? 'text-[#20b886]' : 'text-[#ef4444]')}>
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                    </svg>
                  </div>
                );
              })}
            </div>

            {/* Market Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">Market Summary</div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1">
                    <span>🟠🟠🟠🟠</span> Uncertain Sentiment · Jan 1, 2026, EST · Market Closed
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {MARKET_SUMMARY.map((item, idx) => {
                  const open = openSummary[idx] ?? false;
                  return (
                    <div key={item.title} className="rounded-[12px] border border-[#27272a] bg-[#1a1a1a] p-5">
                      <button
                        className="w-full flex items-center justify-between text-left"
                        onClick={() => setOpenSummary((prev) => ({ ...prev, [idx]: !open }))}
                      >
                        <span className="text-sm text-white font-semibold">{item.title}</span>
                        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                      </button>
                      {open && (
                        <p className="mt-3 text-sm text-zinc-400 leading-6">
                          {item.body}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Developments */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RECENT_DEVS.map((dev) => (
                <div
                  key={dev.title}
                  className="rounded-[12px] border border-[#27272a] bg-[#1a1a1a] p-4 cursor-pointer transition-colors hover:border-[rgba(32,184,134,0.4)]"
                >
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                    <Clock3 className="h-3 w-3" />
                    <span>{dev.time}</span>
                  </div>
                  <div className="text-base font-semibold text-white leading-snug line-clamp-2 mb-2">
                    {dev.title}
                  </div>
                  <div className="text-sm text-zinc-400 leading-6 line-clamp-3">
                    {dev.summary}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">Earnings Calendar</div>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <button className="px-3 py-1 rounded-md bg-[#1a1a1a] border border-[#27272a] hover:border-[#20b886]">Today</button>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 rounded-md bg-[#1a1a1a] border border-[#27272a]">{"<"}</button>
                  <button className="px-2 py-1 rounded-md bg-[#1a1a1a] border border-[#27272a]">{">"}</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {mockEarningsWeek.map((day) => {
                const hasCalls = day.calls > 0;
                return (
                  <div
                    key={day.date}
                    className={cn(
                      'rounded-[12px] border p-3 bg-[#1a1a1a] border-[#27272a] space-y-2',
                      hasCalls && 'border-[#20b886] bg-[rgba(32,184,134,0.08)]'
                    )}
                  >
                    <div className="text-xs text-zinc-500">{day.day}</div>
                    <div className="text-sm font-semibold text-white">{day.date}</div>
                    {hasCalls ? (
                      <div className="text-sm text-[#20b886] flex items-center gap-1">
                        <span>🔵</span> {day.calls} {day.calls === 1 ? 'Call' : 'Calls'}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">No Calls</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-[12px] border border-[#27272a] bg-[#1a1a1a] p-6">
              <div className="text-base font-semibold text-white mb-3">Selected Day Details</div>
              <div className="space-y-4">
                {mockEarningsWeek.find((d) => d.calls > 0)?.items?.map((item) => (
                  <div key={item.ticker} className="flex items-center justify-between text-sm text-zinc-100 border border-[#27272a] rounded-lg p-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{item.ticker}</div>
                      <div className="text-xs text-zinc-500">{item.company}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="rounded-full px-2 py-1 border border-[#27272a]">
                        {item.time === 'BMO' ? 'Before Market' : 'After Close'}
                      </span>
                      <span className="font-mono text-sm text-white">
                        EPS: {item.expectedEPS.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )) || (
                  <div className="text-sm text-zinc-500 text-center py-10">No Earnings Calls</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TABS.find((t) => t.key === 'earnings')?.chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  disabled={isTyping}
                  className="px-4 py-2 rounded-full text-[13px] text-zinc-400 border border-[#27272a] bg-[#1a1a1a] hover:border-[#20b886] hover:text-[#20b886] disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'politicians' && (
          <div className="space-y-4">
            <div className="text-lg font-semibold text-white">Politician Trading Activity</div>
            <div className="relative">
              <div className="flex items-center rounded-lg bg-[#1a1a1a] border border-[#27272a] px-4 py-3">
                <Search className="h-4 w-4 text-zinc-500 mr-3" />
                <input
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
                  placeholder="Select politician..."
                />
              </div>
            </div>
            <div className="rounded-[12px] border border-[#27272a]">
              <div className="grid grid-cols-12 text-xs text-zinc-500 px-4 py-3 border-b border-[#27272a]">
                <div className="col-span-3">Recent Transactions</div>
                <div className="col-span-2">Transaction</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Filed After</div>
                <div className="col-span-3 text-right">Amount</div>
              </div>
              <div>
                {mockPoliticians.map((p) => (
                  <div
                    key={p.name}
                    className="grid grid-cols-12 px-4 py-4 text-sm text-white border-b border-[#27272a] hover:bg-white/5 cursor-pointer"
                  >
                    <div className="col-span-3">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-zinc-500">🏛 {p.party}</div>
                    </div>
                    <div className="col-span-2 text-zinc-400 text-sm">{p.transaction}</div>
                    <div className="col-span-2">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs',
                        p.type === 'Buy' ? 'bg-[rgba(32,184,134,0.12)] text-[#20b886]' : 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]'
                      )}>
                        {p.type}
                      </span>
                      <div className="text-[11px] text-zinc-500">Undisclosed</div>
                    </div>
                    <div className="col-span-2 text-sm">{p.filedAfter}</div>
                    <div className="col-span-3 text-right font-mono text-sm text-[#20b886]">
                      {p.amount} {'💰'.repeat(p.coins)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center text-xs text-zinc-500 py-3 gap-3">
                <button className="hover:text-white">{'< Previous'}</button>
                <span>Page 1</span>
                <button className="hover:text-white">{'Next >'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            <div className="rounded-[12px] border border-[#27272a] bg-[#1a1a1a] p-5">
              <div className="text-base font-semibold text-white mb-3">Watchlist Summary</div>
              <p className="text-sm text-zinc-400 leading-7 whitespace-pre-line">
                {mockWatchlistSummary}
              </p>
              <div className="text-[11px] text-zinc-500 text-right mt-3">Updated 7 minutes ago</div>
            </div>

            <div className="rounded-[12px] border border-[#27272a] bg-[#1a1a1a]">
              <div className="grid grid-cols-6 text-xs text-zinc-500 px-4 py-3 border-b border-[#27272a]">
                <div className="col-span-2">Name</div>
                <div>Price</div>
                <div>1D</div>
                <div>5D</div>
                <div>1M</div>
              </div>
              {mockWatchlist.map((s) => (
                <div key={s.ticker} className="grid grid-cols-6 px-4 py-3 items-center text-sm border-b border-[#27272a]">
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-[#2a2a2a]" />
                    <div>
                      <div className="text-sm font-semibold text-white">{s.name}</div>
                      <div className="text-xs text-zinc-500">{s.ticker}</div>
                    </div>
                  </div>
                  <div className="font-mono text-white">{s.price.toFixed(2)}</div>
                  <div className={cn('font-mono', s.change1D >= 0 ? 'text-[#20b886]' : 'text-[#ef4444]')}>{s.change1D.toFixed(2)}%</div>
                  <div className={cn('font-mono', s.change5D >= 0 ? 'text-[#20b886]' : 'text-[#ef4444]')}>{s.change5D.toFixed(2)}%</div>
                  <div className={cn('font-mono', s.change1M >= 0 ? 'text-[#20b886]' : 'text-[#ef4444]')}>{s.change1M.toFixed(2)}%</div>
                  <div className={cn('font-mono', s.change6M >= 0 ? 'text-[#20b886]' : 'text-[#ef4444]')}>{s.change6M.toFixed(2)}%</div>
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
