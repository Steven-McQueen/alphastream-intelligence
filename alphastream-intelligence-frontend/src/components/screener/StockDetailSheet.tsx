import { useState, useEffect, useMemo } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Stock } from "@/types"
import { BarChart3, FileText, TrendingUp, X, Bot, User, Star } from "lucide-react"
import { PerplexityChatInput } from "@/components/ui/PerplexityChatInput"
import { cn } from "@/lib/utils"
import { COMPANY_DESCRIPTIONS } from "@/lib/mockData/companyDescriptions"
import { useWatchlist } from "@/contexts/WatchlistContext"
import { StockOverviewMetrics } from "@/components/StockOverviewMetrics"

const API_BASE_URL = "http://localhost:8000";

const TAG_CATEGORIES = {
  "Investment Style": ['Growth', 'Value', 'Quality', 'Momentum', 'Contrarian', 'Deep Value'],
  "Time Horizon": ['Long-term', 'Medium-term', 'Short-term', 'Swing Trade'],
  "Risk Profile": ['High Volatility', 'Low Volatility', 'Defensive', 'Speculative', 'Blue Chip'],
  "Market Cap": ['Large Cap', 'Mid Cap', 'Small Cap', 'Mega Cap'],
  "Sector Themes": ['Tech', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial'],
  "Catalysts": ['Earnings Catalyst', 'M&A Potential', 'Product Launch', 'Regulatory', 'Turnaround', 'Index Inclusion'],
  "Watchlist Status": ['Buying Opportunity', 'Watch Closely', 'Overvalued', 'Sell Candidate', 'Research Needed'],
} as const;

const ALL_TAGS = Object.values(TAG_CATEGORIES).flat();

interface StockDetailSheetProps {
  stock: Stock | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StockDetailSheet({ stock, open, onOpenChange }: StockDetailSheetProps) {
  const [stockData, setStockData] = useState<Stock | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [timeRange, setTimeRange] = useState<string>("1D")
  const [chatMessages, setChatMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string; kind?: "error" }[]
  >([])
  const [isTyping, setIsTyping] = useState(false)
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const [notes, setNotes] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    const fetchDetail = async () => {
      if (!stock?.ticker) return;
      try {
        setLoadingDetail(true);
        const res = await fetch(`${API_BASE_URL}/api/stock/${stock.ticker}`);
        if (!res.ok) throw new Error("Stock not found");
        const data: Stock = await res.json();
        setStockData(data);
      } catch (err) {
        console.error("Error fetching stock detail", err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [stock?.ticker]);

  useEffect(() => {
    if (!stock) return;
    const savedNotes = localStorage.getItem(`notes_${stock.ticker}`);
    const savedTags = localStorage.getItem(`tags_${stock.ticker}`);
    setNotes(savedNotes || "");
    setSelectedTags(savedTags ? JSON.parse(savedTags) : []);
  }, [stock]);

  useEffect(() => {
    if (!stock) return;
    localStorage.setItem(`notes_${stock.ticker}`, notes);
  }, [notes, stock]);

  useEffect(() => {
    if (!stock) return;
    localStorage.setItem(`tags_${stock.ticker}`, JSON.stringify(selectedTags));
  }, [selectedTags, stock]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearAllTags = () => setSelectedTags([]);

  if (!stock) return null
  const currentStock = stockData ?? stock

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full max-w-none p-0 !max-w-[100vw]"
        style={{ width: '100vw', maxWidth: '100vw' }}
      >
        {/* HEADER - STICKY */}
        <div className="sticky top-0 z-50 bg-background border-b">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <div className="flex items-baseline gap-3 mb-2">
                <h2 className="text-3xl font-bold">{currentStock.ticker}</h2>
                <span className="text-base text-muted-foreground">{currentStock.name}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold">
                  ${typeof currentStock.price === 'number' ? currentStock.price.toFixed(2) : currentStock.price}
                </span>
                <span className={`text-lg font-medium ${(currentStock.change1D ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(currentStock.change1D ?? 0) >= 0 ? '+' : ''}{(currentStock.change1D ?? 0).toFixed(2)}%
                </span>
                  <button
                    onClick={() => toggleWatchlist(currentStock.ticker)}
                    className={cn(
                      "ml-4 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                      isInWatchlist(currentStock.ticker)
                        ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 hover:bg-yellow-500/30"
                        : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                    )}
                  >
                    <Star className={cn("w-4 h-4", isInWatchlist(currentStock.ticker) && "fill-current")} />
                    {isInWatchlist(currentStock.ticker) ? "Remove from Watchlist" : "Add to Watchlist"}
                  </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm px-3 py-1">
                {currentStock.sector}
              </Badge>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* BODY - TWO COLUMNS */}
        <div className="flex h-[calc(100vh-140px)]">

          {/* LEFT COLUMN - SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto bg-background">
            <div className="p-8 space-y-6 max-w-[1200px]">

              {/* CHART SECTION */}
              <Card className="p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-2 flex-wrap">
                    {['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'].map((range) => (
                      <Button
                        key={range}
                        variant={timeRange === range ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange(range)}
                        className="h-8 px-3"
                      >
                        {range}
                      </Button>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Prev close: {currentStock.price ? (currentStock.price / (1 + (currentStock.change1D ?? 0) / 100)).toFixed(2) : 'N/A'}
                  </span>
                </div>

                <div className="h-[400px] bg-zinc-900 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-500 text-sm">Chart visualization will be here</p>
                    <p className="text-zinc-600 text-xs mt-2">Showing {timeRange} data for {currentStock.ticker}</p>
                  </div>
                </div>
              </Card>

              {/* METRICS GRID */}
              <Card className="p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Key Metrics</h3>
                <div className="grid grid-cols-4 gap-6">
                  {/* Row 1 */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Prev Close</p>
                    <p className="text-sm font-medium">
                      ${currentStock.price ? (currentStock.price / (1 + (currentStock.change1D ?? 0) / 100)).toFixed(2) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">52W Range</p>
                    <p className="text-sm font-medium">185.32 - 232.45</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Open</p>
                    <p className="text-sm font-medium">${currentStock.price?.toFixed(2) ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Day Range</p>
                    <p className="text-sm font-medium">230.15 - 232.80</p>
                  </div>

                  {/* Row 2 */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Volume</p>
                    <p className="text-sm font-medium">{currentStock.volume?.toLocaleString() ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg Volume</p>
                    <p className="text-sm font-medium">{currentStock.avgVolume?.toLocaleString() ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">YTD Return</p>
                    <p className={`text-sm font-medium ${((currentStock.change1D ?? 0) * 12) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {((currentStock.change1D ?? 0) * 12).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">1Y Return</p>
                    <p className={`text-sm font-medium ${currentStock.change1Y && currentStock.change1Y > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {currentStock.change1Y?.toFixed(2) ?? 'N/A'}%
                    </p>
                  </div>
                </div>
              </Card>

              {/* About Company */}
              <div className="mt-6 px-0">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 tracking-tight">
                    About {currentStock.name}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {COMPANY_DESCRIPTIONS[currentStock.ticker] || (
                      <span className="italic">
                        Company description will be available soon.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* NEWS SECTION */}
              <Card className="p-6 bg-card">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-semibold text-lg">📰 Related News</h3>
                  <Badge variant="secondary" className="text-xs">3</Badge>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      category: "Earnings",
                      source: "Reuters",
                      time: "7m ago",
                      headline: "Q4 Results Beat Expectations",
                      description: "Company reports strong quarterly performance with revenue up 15% YoY...",
                      tickers: [currentStock.ticker, "SPY"]
                    },
                    {
                      category: "Analyst",
                      source: "Bloomberg",
                      time: "2h ago",
                      headline: "Price Target Raised to $250",
                      description: "Morgan Stanley increases target citing strong e-commerce growth...",
                      tickers: [currentStock.ticker]
                    },
                    {
                      category: "Market",
                      source: "CNBC",
                      time: "5h ago",
                      headline: "Consumer Discretionary Sector Gains",
                      description: "Institutional investors showing renewed interest in retail stocks...",
                      tickers: [currentStock.ticker, "XLY"]
                    }
                  ].map((item, idx) => (
                    <div 
                      key={idx} 
                      className="border-b border-border last:border-0 pb-4 last:pb-0"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.source} · {item.time}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm mb-1">{item.headline}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                      <div className="flex gap-1">
                        {item.tickers.map((ticker) => (
                          <Badge key={ticker} variant="secondary" className="text-xs">
                            {ticker}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* AI CHAT SECTION */}
              <Card className="p-0 bg-[#09090b] border border-white/10 overflow-hidden">
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-white/90">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    Ask about {currentStock.ticker}
                  </h3>
                  <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={() => onOpenChange(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex flex-col h-[420px]">
                  <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="h-full" />
                    ) : (
                      chatMessages.map((msg) => {
                        if (msg.kind === "error") {
                          return (
                            <div key={msg.id} className="flex justify-start">
                              <div className="max-w-[80%] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3">
                                <p className="text-sm text-red-400">{msg.content}</p>
                              </div>
                            </div>
                          )
                        }
                        if (msg.role === "assistant" && msg.content === "__typing__") {
                          return (
                            <div key={msg.id} className="flex justify-start mb-4">
                              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </div>
                            </div>
                          )
                        }
                        const isUser = msg.role === "user";
                        return (
                          <div key={msg.id} className={cn("flex mb-4", isUser ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3 border",
                                isUser
                                  ? "bg-blue-600/20 border-blue-500/30 rounded-tr-sm"
                                  : "bg-white/5 border-white/10 rounded-tl-sm"
                              )}
                            >
                              <p className="text-sm text-white/90 leading-relaxed">{msg.content}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="sticky bottom-0 border-t border-white/10 bg-zinc-950 px-4 py-4">
                    <PerplexityChatInput
                      value={""}
                      onValueChange={() => {}}
                      onSubmit={(text) => {
                        if (!text.trim()) return;
                        const id = Date.now().toString();
                        const userMessage = { id, role: "user" as const, content: text.trim() };
                        setChatMessages((prev) => [...prev, userMessage]);
                        setIsTyping(true);
                        const typingId = `${id}-typing`;
                        setChatMessages((prev) => [...prev, { id: typingId, role: "assistant", content: "__typing__" }]);

                        setTimeout(() => {
                          setChatMessages((prev) => prev.filter((m) => m.id !== typingId));
                          const aiMessage = {
                            id: `${id}-ai`,
                            role: "assistant" as const,
                            content: `I am analyzing ${currentStock.ticker}... ${text.trim()} — here’s a quick mock analysis with fundamentals, news, and risks.`,
                          };
                          setChatMessages((prev) => [...prev, aiMessage]);
                          setIsTyping(false);
                        }, 1500);
                      }}
                      animatedPlaceholder=""
                      placeholder={`Ask about ${currentStock.ticker}...`}
                    />
                  </div>
                </div>
              </Card>

            </div>
          </div>

          {/* RIGHT COLUMN - FIXED WIDTH SIDEBAR */}
          <div className="w-[420px] border-l border-border bg-card/30 overflow-y-auto flex-shrink-0">
            <div className="p-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="overview" className="text-xs">
                    <BarChart3 className="w-3 h-3 mr-1" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs">
                    <FileText className="w-3 h-3 mr-1" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="filings" className="text-xs">
                    <FileText className="w-3 h-3 mr-1" />
                    Filings
                  </TabsTrigger>
                  <TabsTrigger value="score" className="text-xs">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Score
                  </TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <Card className="p-0">
                    {loadingDetail ? (
                      <div className="p-6 text-sm text-muted-foreground">Loading details...</div>
                    ) : (
                      <StockOverviewMetrics stock={currentStock} />
                    )}
                  </Card>
                </TabsContent>

                {/* NOTES TAB */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <Card className="bg-[#0f0f11] border border-[#27272a] rounded-xl overflow-hidden">
                    <div className="flex-1 p-4 border-b border-[#27272a]">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={() => {
                          if (stock) localStorage.setItem(`notes_${stock.ticker}`, notes);
                        }}
                        placeholder="Write your investment thesis, observations, or reminders..."
                        className="w-full h-full bg-transparent border-none resize-none text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
                        style={{ minHeight: '300px' }}
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Tags</h4>
                        <button
                          onClick={handleClearAllTags}
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ALL_TAGS.map((tag) => {
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleTag(tag)}
                              className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                                isSelected
                                  ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                  : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                              )}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* FILINGS TAB */}
                <TabsContent value="filings" className="mt-4 space-y-4">
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">Recent Filings</h4>
                    <div className="space-y-3">
                      <div className="border-b pb-2 last:border-0">
                        <div className="flex justify-between items-start mb-1">
                          <Badge variant="outline" className="text-xs">10-K</Badge>
                          <span className="text-xs text-muted-foreground">2 days ago</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Annual report showing strong fundamentals and revenue growth...
                        </p>
                      </div>
                      <div className="border-b pb-2 last:border-0">
                        <div className="flex justify-between items-start mb-1">
                          <Badge variant="outline" className="text-xs">8-K</Badge>
                          <span className="text-xs text-muted-foreground">1 week ago</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Material event disclosure regarding strategic acquisition...
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">LLM Summary</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {currentStock.ticker} demonstrates strong market positioning in the {currentStock.sector} sector. 
                      Recent performance indicates solid fundamentals with consistent growth trajectory. 
                      Management guidance remains constructive for upcoming quarters.
                    </p>
                  </Card>
                </TabsContent>

                {/* SCORE TAB */}
                <TabsContent value="score" className="mt-4 space-y-4">
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">Quality Scores</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Quality Score</span>
                          <span className="font-medium">{currentStock.qualityScore ?? 0}/100</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all" 
                            style={{ width: `${currentStock.qualityScore ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Momentum Score</span>
                          <span className="font-medium">{currentStock.momentumScore ?? 0}/100</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all" 
                            style={{ width: `${currentStock.momentumScore ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Value Score</span>
                          <span className="font-medium">{currentStock.valueScore ?? 0}/100</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 transition-all" 
                            style={{ width: `${currentStock.valueScore ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Sentiment Score</span>
                          <span className="font-medium">{currentStock.sentimentScore ?? 0}/100</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-500 transition-all" 
                            style={{ width: `${currentStock.sentimentScore ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">Catalysts</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {currentStock.catalysts && currentStock.catalysts.length > 0 ? (
                        currentStock.catalysts.map((catalyst, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {catalyst}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Earnings Soon
                        </Badge>
                      )}
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}