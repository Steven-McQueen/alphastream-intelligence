import { HeroSection } from '@/components/finance/HeroSection';
import { IndicesMacroCard } from '@/components/finance/IndicesMacroCard';
import { EarningsHub } from '@/components/finance/EarningsHub';
import { StandoutsCard } from '@/components/finance/StandoutsCard';
import { ThemesExplorer } from '@/components/finance/ThemesExplorer';
import { TopMovers } from '@/components/TopMovers';
import { SectorPerformance } from '@/components/SectorPerformance';
import { MyWatchlist } from '@/components/MyWatchlist';
import { TodaysMarketInsight } from '@/components/TodaysMarketInsight';

export default function FinanceHome() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero - Full width with subtle gradient */}
      <div className="bg-gradient-to-b from-muted/20 to-transparent">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <HeroSection />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-4 space-y-5">

        {/* Market Insight Banner */}
        <section>
          <TodaysMarketInsight />
        </section>

        {/* Primary Grid: Indices & Sectors */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-1 bg-cyan-500 rounded-full" />
            <h2 className="text-lg font-semibold text-foreground">Markets Overview</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IndicesMacroCard />
            <SectorPerformance />
          </div>
        </section>

        {/* Earnings Calendar - Full Width */}
        <section>
          <EarningsHub />
        </section>

        {/* Secondary Grid: Movers & Standouts */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-1 bg-emerald-500 rounded-full" />
            <h2 className="text-lg font-semibold text-foreground">Today's Activity</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopMovers />
            <StandoutsCard />
          </div>
        </section>

        {/* Watchlist - Full Width */}
        <section>
          <MyWatchlist />
        </section>

        {/* Themes Explorer */}
        <section className="pb-8">
          <ThemesExplorer />
        </section>
      </div>
    </div>
  );
}
