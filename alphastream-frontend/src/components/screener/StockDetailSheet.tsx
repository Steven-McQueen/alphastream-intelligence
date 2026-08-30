import { useState, useEffect, useRef } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Stock } from "@/types"
import { X, Star, ExternalLink } from "lucide-react"
import { ChatOverlay } from "@/components/chat/ChatOverlay"
import { cn } from "@/lib/utils"
import { useWatchlist } from "@/contexts/WatchlistContext"
import { useStockDetail } from "@/contexts/StockDetailContext"
import { useMarket } from "@/contexts/MarketContext"
import { StockChart } from "@/components/charts/StockChart"
import { StockNews } from "@/components/screener/StockNews"
import { FinancialReports } from "@/components/screener/FinancialReports"
import { HistoricalData } from "@/components/screener/HistoricalData"
import { StockNotes } from "@/components/screener/StockNotes"
import { ValuationMetrics } from "@/components/screener/ValuationMetrics"
import { SimilarCompanies } from "@/components/screener/SimilarCompanies"
import { AnalystConsensus } from "@/components/screener/AnalystConsensus"
import { RevenueEarningsChart } from "@/components/screener/RevenueEarningsChart"
import { InsiderTrades } from "@/components/screener/InsiderTrades"
import { EarningsHistory } from "@/components/screener/EarningsHistory"
import { OverviewSection } from "@/components/screener/OverviewSection"
import { DCFValuation } from "@/components/screener/DCFValuation"
import { AnalystRatings } from "@/components/screener/AnalystRatings"
import { PoliticianTrades } from "@/components/screener/PoliticianTrades"
import { API_BASE_URL } from "@/config/api";
import type { IndexInstrument } from "@/lib/indexMeta";
import { getIndexAbout, getIndexDisplayName } from "@/lib/indexMeta";

// Navigation tabs
const STOCK_NAV_TABS = ["Overview", "Financial Reports", "Historical Data", "DCF", "Politicians", "News"] as const;
const INDEX_NAV_TABS = ["Overview", "Historical Data"] as const;
type NavTab = typeof STOCK_NAV_TABS[number];

interface StockDetailSheetProps {
  stock: Stock | null
  index?: IndexInstrument | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

// Company profile interface
interface CompanyProfile {
  symbol: string;
  companyName: string;
  description: string;
  image: string;
  ceo: string;
  sector: string;
  industry: string;
  website: string;
  exchange: string;
  exchangeFullName: string;
  marketCap: number;
  averageVolume: number;
  ipoDate: string;
  country: string;
  city: string;
  state: string;
  fullTimeEmployees: string;
}

// Helper function to format market cap
function formatMarketCap(value: number | undefined): string {
  if (!value) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

// Helper function to format employees
function formatEmployees(value: string | undefined): string {
  if (!value) return "N/A";
  const num = parseInt(value);
  if (isNaN(num)) return value;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toLocaleString();
}

function formatVolume(value: number | undefined | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
}

function formatLevel(value: number | undefined | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper to format IPO date
function formatIpoDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// Info row component for the company panel
function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 px-2 -mx-2 rounded-lg border-b border-border/50 last:border-0 hover:bg-muted transition-colors duration-200">
      <span className="text-sm text-dim">{label}</span>
      {isLink && value !== "N/A" ? (
        <a 
          href={value.startsWith("http") ? value : `https://${value}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          {value.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-sm font-medium text-foreground">{value}</span>
      )}
    </div>
  );
}

export function StockDetailSheet({ stock, index = null, open, onOpenChange }: StockDetailSheetProps) {
  const [stockData, setStockData] = useState<Stock | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false)
  const [indexQuote, setIndexQuote] = useState<IndexQuote | null>(null)
  const [activeTab, setActiveTab] = useState<NavTab>("Overview")
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const { closeStockDetail } = useStockDetail();
  const { isMarketOpen } = useMarket();
  const isIndex = Boolean(index?.symbol);
  const navTabs = isIndex ? INDEX_NAV_TABS : STOCK_NAV_TABS;

  // Track the latest stock data for passing on close
  const latestStockDataRef = useRef<Stock | null>(null);

  // Keep ref updated with latest fetched data
  useEffect(() => {
    if (stockData) {
      latestStockDataRef.current = stockData;
    }
  }, [stockData]);

  // Handle sheet close - pass fresh data back to parent components
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && latestStockDataRef.current) {
      // Pass the fresh stock data to context so Screener/Watchlist can update
      closeStockDetail(latestStockDataRef.current);
      latestStockDataRef.current = null;
    } else {
      onOpenChange(isOpen);
    }
  };

  // Parallel fetch: Load stock detail and profile simultaneously for instant load
  useEffect(() => {
    if (!stock?.ticker) {
      setStockData(null);
      setProfile(null);
      setLoadingDetail(false);
      setLoadingProfile(false);
      return;
    }

    const ticker = stock.ticker;
    setLoadingDetail(true);
    setLoadingProfile(true);

    // Fire ALL requests in parallel for fastest possible load
    Promise.all([
      fetch(`${API_BASE_URL}/api/stock/${ticker}?fresh=1`),
      fetch(`${API_BASE_URL}/api/stock/${ticker}/profile`),
    ]).then(async ([stockRes, profileRes]) => {
      // Process stock detail
      if (stockRes.ok) {
        const stockData: Stock = await stockRes.json();
        setStockData(stockData);
      }
      setLoadingDetail(false);

      // Process profile
      if (profileRes.ok) {
        const profileData: CompanyProfile = await profileRes.json();
        setProfile(profileData);
      }
      setLoadingProfile(false);
    }).catch((err) => {
      console.error("Error fetching stock data", err);
      setLoadingDetail(false);
      setLoadingProfile(false);
    });
  }, [stock?.ticker]);

  // Live polling every 10s when market open and sheet open - priority for visible content
  useEffect(() => {
    if (!open || !stock?.ticker || !isMarketOpen) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${stock.ticker}?fresh=1`);
        if (!res.ok) throw new Error("Stock not found");
        const data: Stock = await res.json();
        if (cancelled) return;
        setStockData(data);
      } catch (err) {
        // ignore single errors
      }
    };
    const id = setInterval(poll, 30000); // 30s polling - active stock sheet (was 10s)
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, stock?.ticker, isMarketOpen]);

  // Index quote (same cadence as the visible stock sheet)
  useEffect(() => {
    if (!index?.symbol) {
      setIndexQuote(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/index/${encodeURIComponent(index.symbol)}/quote`);
        if (!res.ok) return;
        const data: IndexQuote = await res.json();
        if (!cancelled) setIndexQuote(data);
      } catch (err) {
        console.error("Error fetching index quote", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [index?.symbol]);

  useEffect(() => {
    if (!open || !index?.symbol || !isMarketOpen) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/index/${encodeURIComponent(index.symbol)}/quote`);
        if (!res.ok) return;
        const data: IndexQuote = await res.json();
        if (!cancelled) setIndexQuote(data);
      } catch {
        // ignore single errors
      }
    };
    const id = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, index?.symbol, isMarketOpen]);

  // Reset active tab when the instrument changes
  useEffect(() => {
    setActiveTab("Overview");
  }, [stock?.ticker, index?.symbol]);

  if (!stock && !index) return null
  const currentStock = stockData ?? stock
  const displayName = isIndex
    ? (indexQuote?.name || getIndexDisplayName(index!.symbol, index!.name))
    : (profile?.companyName || currentStock?.name || "")
  const displaySymbol = isIndex ? index!.symbol : (currentStock?.ticker || "")
  const displayPrice = isIndex ? indexQuote?.price : currentStock?.price
  const displayChangePct = isIndex ? (indexQuote?.changePercent ?? 0) : (currentStock?.change1D ?? 0)
  const displayChangePts = isIndex ? (indexQuote?.change ?? 0) : 0
  const pricePositive = displayChangePct >= 0
  const indexAbout = isIndex ? getIndexAbout(index!.symbol) : undefined

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full max-w-none p-0 !max-w-[100vw]"
        style={{ width: '100vw', maxWidth: '100vw' }}
      >
        {/* HEADER - STICKY */}
        <div className="sticky top-0 z-50 bg-background">
          {/* Main Header Row */}
          <div className="flex items-center justify-between w-full max-w-[1500px] mx-auto px-8 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              {/* Company Logo */}
              {!isIndex && profile?.image && (
                <img 
                  src={profile.image} 
                  alt={`${displaySymbol} logo`}
                  className="w-14 h-14 rounded-xl object-contain bg-white p-1.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold">{displayName}</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">{displaySymbol}</span>
                  <span>·</span>
                  <span>{isIndex ? "INDEX" : (profile?.exchange || currentStock?.sector)}</span>
                  {!isIndex && profile?.country && (
                    <>
                      <span>·</span>
                      <span>{profile.country === "US" ? "United States" : profile.country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <div className="text-3xl font-bold">
                  {isIndex
                    ? formatLevel(typeof displayPrice === "number" ? displayPrice : undefined)
                    : `$${typeof displayPrice === "number" ? displayPrice.toFixed(2) : (displayPrice ?? "")}`}
                </div>
                <div className={`text-sm font-medium ${pricePositive ? "text-positive" : "text-negative"}`}>
                  {isIndex
                    ? `${displayChangePts >= 0 ? "+" : ""}${displayChangePts.toFixed(2)} (${pricePositive ? "+" : ""}${displayChangePct.toFixed(2)}%)`
                    : `${pricePositive ? "+" : ""}${displayChangePct.toFixed(2)}%`}
                </div>
              </div>
              {!isIndex && currentStock && (
              <button
                onClick={() => toggleWatchlist(currentStock.ticker)}
                className={cn(
                  "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                  isInWatchlist(currentStock.ticker)
                    ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 hover:bg-yellow-500/30"
                    : "bg-muted text-soft border border-secondary hover:bg-secondary"
                )}
              >
                <Star className={cn("w-4 h-4", isInWatchlist(currentStock.ticker) && "fill-current")} />
                {isInWatchlist(currentStock.ticker) ? "Watching" : "Watch"}
              </button>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-border bg-background w-full max-w-[1500px] mx-auto px-8">
            <nav className="flex gap-1">
              {navTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium transition-colors relative",
                    activeTab === tab
                      ? "text-foreground"
                      : "text-dim hover:text-soft"
                  )}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* BODY - SINGLE SCROLL CONTAINER (page scrolls as one; columns float freely) */}
        <div className="h-[calc(100vh-160px)] overflow-y-auto scrollbar-slim bg-background">
          <div className="flex w-full max-w-[1500px] mx-auto">

          {/* LEFT COLUMN - CONTENT */}
          <div className="flex-1 min-w-0">
            <div className="p-8 flex flex-col gap-6 min-h-[calc(100vh-160px)]">

              {activeTab === "Overview" && (
                <>
                  <StockChart
                    symbol={displaySymbol}
                    companyName={displayName}
                    isIndex={isIndex}
                    metrics={isIndex ? {
                      yearHigh: indexQuote?.yearHigh,
                      yearLow: indexQuote?.yearLow,
                      avgVolume: indexQuote?.avgVolume,
                      previousClose: indexQuote?.previousClose,
                    } : {
                      yearHigh: currentStock?.high1Y,
                      yearLow: currentStock?.low1Y,
                      avgVolume: currentStock?.avgVolume,
                      marketCap: currentStock?.marketCap,
                      ytdReturn: currentStock?.changeYTD,
                      oneYearReturn: currentStock?.change1Y,
                      beta: currentStock?.beta,
                    }}
                  />

                  {!isIndex && currentStock && (
                    <div className="mt-6">
                      <ValuationMetrics ticker={currentStock.ticker} />
                    </div>
                  )}

                  <div className="mt-6">
                    {isIndex ? (
                      <OverviewSection title={`About ${displayName}`} kicker="Index Profile">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {indexAbout || (
                            <span className="italic">Index description will be available soon.</span>
                          )}
                        </p>
                      </OverviewSection>
                    ) : (
                      <OverviewSection
                        title={`About ${profile?.companyName || currentStock?.name}`}
                        kicker="Company Profile"
                      >
                        {loadingProfile ? (
                          <div className="text-sm text-dim italic">Loading company information...</div>
                        ) : (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {profile?.description || (
                              <span className="italic">
                                Company description will be available soon.
                              </span>
                            )}
                          </p>
                        )}
                      </OverviewSection>
                    )}
                  </div>

                  {isIndex ? (
                    <StockNews ticker={displaySymbol} feed="market" title="Market News" />
                  ) : (
                    currentStock && <StockNews ticker={currentStock.ticker} />
                  )}
                </>
              )}

              {!isIndex && currentStock && activeTab === "Financial Reports" && (
                <div className="flex gap-6">
                  <div className="flex-1 min-w-0 space-y-6">
                    <FinancialReports ticker={currentStock.ticker} />
                    <EarningsHistory ticker={currentStock.ticker} />
                    <RevenueEarningsChart ticker={currentStock.ticker} />
                  </div>
                  <div className="w-[420px] flex-shrink-0">
                    <AnalystRatings
                      ticker={currentStock.ticker}
                      currentPrice={currentStock.price}
                    />
                  </div>
                </div>
              )}

              {activeTab === "Historical Data" && (
                <HistoricalData ticker={displaySymbol} isIndex={isIndex} />
              )}

              {!isIndex && currentStock && activeTab === "DCF" && (
                <DCFValuation ticker={currentStock.ticker} />
              )}

              {!isIndex && currentStock && activeTab === "Politicians" && (
                <div className="flex gap-6">
                  <div className="flex-1 min-w-0">
                    <PoliticianTrades ticker={currentStock.ticker} />
                  </div>
                  <div className="w-[420px] flex-shrink-0">
                    <InsiderTrades ticker={currentStock.ticker} />
                  </div>
                </div>
              )}

              {!isIndex && currentStock && activeTab === "News" && (
                <StockNews ticker={currentStock.ticker} />
              )}

              <ChatOverlay
                mode="embedded"
                inline
                showHeader={false}
                contextLabel={displaySymbol}
                suggestedPrompts={isIndex ? [
                  `What's driving ${displayName} today?`,
                  `Key factors affecting ${displaySymbol}`,
                  `${displaySymbol} outlook for this week`,
                  `Compare ${displaySymbol} to other indices`,
                ] : [
                  `What's the outlook for ${displaySymbol}?`,
                  `Analyze ${displaySymbol}'s valuation`,
                  `Key risks for ${displaySymbol}?`,
                  `Compare to sector peers`,
                ]}
              />

            </div>
          </div>

          {activeTab === "Overview" && (
            <div className="w-[380px] flex-shrink-0">
              <div className="p-5 pl-0 space-y-5">
                {isIndex ? (
                  <OverviewSection title="Index Info" dense flush>
                    <div className="px-4 py-1">
                      <InfoRow label="Symbol" value={displaySymbol} />
                      <InfoRow label="Previous Close" value={formatLevel(indexQuote?.previousClose)} />
                      <InfoRow label="Open" value={formatLevel(indexQuote?.open)} />
                      <InfoRow label="Day High" value={formatLevel(indexQuote?.dayHigh)} />
                      <InfoRow label="Day Low" value={formatLevel(indexQuote?.dayLow)} />
                      <InfoRow label="52W High" value={formatLevel(indexQuote?.yearHigh)} />
                      <InfoRow label="52W Low" value={formatLevel(indexQuote?.yearLow)} />
                      <InfoRow label="Volume" value={formatVolume(indexQuote?.volume)} />
                      <InfoRow label="Avg Volume" value={formatVolume(indexQuote?.avgVolume)} />
                    </div>
                  </OverviewSection>
                ) : currentStock ? (
                  <>
                    <OverviewSection title="Company Info" dense flush>
                      <div className="px-4 py-1">
                        <InfoRow label="Symbol" value={currentStock.ticker} />
                        <InfoRow label="Market Cap" value={formatMarketCap(profile?.marketCap || currentStock.marketCap)} />
                        <InfoRow label="IPO Date" value={formatIpoDate(profile?.ipoDate)} />
                        <InfoRow label="CEO" value={profile?.ceo || "N/A"} />
                        <InfoRow label="Fulltime Employees" value={formatEmployees(profile?.fullTimeEmployees)} />
                        <InfoRow label="Sector" value={profile?.sector || currentStock.sector || "N/A"} />
                        <InfoRow label="Industry" value={profile?.industry || "N/A"} />
                        <InfoRow label="Country" value={profile?.country === "US" ? "United States" : (profile?.country || "N/A")} />
                        <InfoRow label="Exchange" value={profile?.exchangeFullName || profile?.exchange || "N/A"} />
                        {profile?.website && <InfoRow label="Website" value={profile.website} isLink />}
                      </div>
                    </OverviewSection>
                    <AnalystConsensus ticker={currentStock.ticker} currentPrice={currentStock.price} />
                    <SimilarCompanies ticker={currentStock.ticker} compact />
                    <OverviewSection title="Notes" dense>
                      <StockNotes ticker={currentStock.ticker} />
                    </OverviewSection>
                  </>
                ) : null}
              </div>
            </div>
          )}

          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
