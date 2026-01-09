import { useState, useEffect } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Stock } from "@/types"
import { X, Star, ExternalLink } from "lucide-react"
import { ChatInterface } from "@/components/chat/ChatInterface"
import { cn } from "@/lib/utils"
import { useWatchlist } from "@/contexts/WatchlistContext"
import { useMarket } from "@/context/MarketContext"
import { StockChart } from "@/components/charts/StockChart"
import { StockNews } from "@/components/screener/StockNews"

const API_BASE_URL = "http://localhost:8000";

// Navigation tabs
const NAV_TABS = ["Overview", "Financials", "Historical Data", "Congress", "News"] as const;
type NavTab = typeof NAV_TABS[number];

interface StockDetailSheetProps {
  stock: Stock | null
  open: boolean
  onOpenChange: (open: boolean) => void
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
    <div className="flex items-center justify-between py-3 border-b border-zinc-800/50 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
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
        <span className="text-sm font-medium text-white">{value}</span>
      )}
    </div>
  );
}

export function StockDetailSheet({ stock, open, onOpenChange }: StockDetailSheetProps) {
  const [stockData, setStockData] = useState<Stock | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<NavTab>("Overview")
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const { isMarketOpen } = useMarket();

  useEffect(() => {
    const fetchDetail = async (fresh: boolean) => {
      if (!stock?.ticker) return;
      try {
        setLoadingDetail(true);
        const url = `${API_BASE_URL}/api/stock/${stock.ticker}${fresh ? '?fresh=1' : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Stock not found");
        const data: Stock = await res.json();
        setStockData(data);
      } catch (err) {
        console.error("Error fetching stock detail", err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail(true);
  }, [stock?.ticker]);

  // Fetch company profile (logo, description, etc.)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!stock?.ticker) return;
      try {
        setLoadingProfile(true);
        const res = await fetch(`${API_BASE_URL}/api/stock/${stock.ticker}/profile`);
        if (res.ok) {
          const data: CompanyProfile = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Error fetching company profile", err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [stock?.ticker]);

  // Live polling every 5s when market open and sheet open
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
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, stock?.ticker, isMarketOpen]);

  // Reset active tab when stock changes
  useEffect(() => {
    setActiveTab("Overview");
  }, [stock?.ticker]);

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
        <div className="sticky top-0 z-50 bg-background">
          {/* Main Header Row */}
          <div className="flex items-center justify-between px-8 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              {/* Company Logo */}
              {profile?.image && (
                <img 
                  src={profile.image} 
                  alt={`${currentStock.ticker} logo`}
                  className="w-14 h-14 rounded-xl object-contain bg-white p-1.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold">{profile?.companyName || currentStock.name}</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span className="font-medium">{currentStock.ticker}</span>
                  <span>·</span>
                  <span>{profile?.exchange || currentStock.sector}</span>
                  {profile?.country && (
                    <>
                      <span>·</span>
                      <span className="text-lg">{profile.country === "US" ? "🇺🇸" : profile.country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <div className="text-3xl font-bold">
                  ${typeof currentStock.price === 'number' ? currentStock.price.toFixed(2) : currentStock.price}
                </div>
                <div className={`text-sm font-medium ${(currentStock.change1D ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(currentStock.change1D ?? 0) >= 0 ? '+' : ''}{(currentStock.change1D ?? 0).toFixed(2)}%
                </div>
              </div>
              <button
                onClick={() => toggleWatchlist(currentStock.ticker)}
                className={cn(
                  "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                  isInWatchlist(currentStock.ticker)
                    ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 hover:bg-yellow-500/30"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                )}
              >
                <Star className={cn("w-4 h-4", isInWatchlist(currentStock.ticker) && "fill-current")} />
                {isInWatchlist(currentStock.ticker) ? "Watching" : "Watch"}
              </button>
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
          <div className="border-b border-border bg-background px-8">
            <nav className="flex gap-1">
              {NAV_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium transition-colors relative",
                    activeTab === tab
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300"
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

        {/* BODY - TWO COLUMNS */}
        <div className="flex h-[calc(100vh-160px)]">

          {/* LEFT COLUMN - SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto bg-background">
            <div className="p-8 space-y-6 max-w-[1200px]">

              {activeTab === "Overview" && (
                <>
                  {/* CHART SECTION */}
                  <StockChart 
                    symbol={currentStock.ticker} 
                    companyName={currentStock.name}
                    metrics={{
                      yearHigh: currentStock.high1Y,
                      yearLow: currentStock.low1Y,
                      avgVolume: currentStock.avgVolume,
                      marketCap: currentStock.marketCap,
                      ytdReturn: currentStock.changeYTD,
                      oneYearReturn: currentStock.change1Y,
                    }}
                  />

                  {/* About Company */}
                  <div className="mt-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 tracking-tight">
                        About {profile?.companyName || currentStock.name}
                      </h3>
                      {loadingProfile ? (
                        <div className="text-sm text-zinc-500 italic">Loading company information...</div>
                      ) : (
                        <p className="text-sm text-zinc-400 leading-relaxed">
                          {profile?.description || (
                            <span className="italic">
                              Company description will be available soon.
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* NEWS SECTION */}
                  <StockNews ticker={currentStock.ticker} />

                  {/* AI CHAT SECTION */}
                  <ChatInterface
                    contextType="stock"
                    contextLabel={currentStock.ticker}
                    placeholder={`Ask about ${currentStock.ticker}...`}
                    suggestedPrompts={[
                      `What's the outlook for ${currentStock.ticker}?`,
                      `Analyze ${currentStock.ticker}'s valuation`,
                      `Key risks for ${currentStock.ticker}?`,
                      `Compare to sector peers`,
                    ]}
                    className="h-[500px]"
                    compact
                  />
                </>
              )}

              {activeTab === "Financials" && (
                <div className="flex items-center justify-center h-64 text-zinc-500">
                  <div className="text-center">
                    <p className="text-lg font-medium mb-2">Financials</p>
                    <p className="text-sm">Coming soon...</p>
                  </div>
                </div>
              )}

              {activeTab === "Historical Data" && (
                <div className="flex items-center justify-center h-64 text-zinc-500">
                  <div className="text-center">
                    <p className="text-lg font-medium mb-2">Historical Data</p>
                    <p className="text-sm">Coming soon...</p>
                  </div>
                </div>
              )}

              {activeTab === "Congress" && (
                <div className="flex items-center justify-center h-64 text-zinc-500">
                  <div className="text-center">
                    <p className="text-lg font-medium mb-2">Congressional Trading</p>
                    <p className="text-sm">Coming soon...</p>
                  </div>
                </div>
              )}

              {activeTab === "News" && (
                <StockNews ticker={currentStock.ticker} />
              )}

            </div>
          </div>

          {/* RIGHT COLUMN - COMPANY INFO PANEL */}
          <div className="w-[380px] border-l border-border bg-zinc-950/50 overflow-y-auto flex-shrink-0">
            <div className="p-6">
              {/* Company Info Section */}
              <div className="space-y-0">
                <InfoRow 
                  label="Symbol" 
                  value={currentStock.ticker} 
                />
                <InfoRow 
                  label="Market Cap" 
                  value={formatMarketCap(profile?.marketCap || currentStock.marketCap)} 
                />
                <InfoRow 
                  label="IPO Date" 
                  value={formatIpoDate(profile?.ipoDate)} 
                />
                <InfoRow 
                  label="CEO" 
                  value={profile?.ceo || "N/A"} 
                />
                <InfoRow 
                  label="Fulltime Employees" 
                  value={formatEmployees(profile?.fullTimeEmployees)} 
                />
                <InfoRow 
                  label="Sector" 
                  value={profile?.sector || currentStock.sector || "N/A"} 
                />
                <InfoRow 
                  label="Industry" 
                  value={profile?.industry || "N/A"} 
                />
                <InfoRow 
                  label="Country" 
                  value={profile?.country === "US" ? "United States" : (profile?.country || "N/A")} 
                />
                <InfoRow 
                  label="Exchange" 
                  value={profile?.exchangeFullName || profile?.exchange || "N/A"} 
                />
                {profile?.website && (
                  <InfoRow 
                    label="Website" 
                    value={profile.website} 
                    isLink 
                  />
                )}
              </div>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
