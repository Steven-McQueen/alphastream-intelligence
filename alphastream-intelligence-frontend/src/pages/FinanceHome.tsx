import { HeroSection } from '@/components/finance/HeroSection';
import { IndicesMacroCard } from '@/components/finance/IndicesMacroCard';
import { EarningsHub } from '@/components/finance/EarningsHub';
import { StandoutsCard } from '@/components/finance/StandoutsCard';
import { ThemesExplorer } from '@/components/finance/ThemesExplorer';
import { TasksAlertsPreview } from '@/components/finance/TasksAlertsPreview';
import { TopMovers } from '@/components/TopMovers';
import { SectorPerformance } from '@/components/SectorPerformance';
import { MyWatchlist } from '@/components/MyWatchlist';
import { TodaysMarketInsight } from '@/components/TodaysMarketInsight';

export default function FinanceHome() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto">
      {/* Section 1: Hero */}
      <HeroSection />

      {/* Section 2: Today in Markets */}
      <TodaysMarketInsight />

      {/* Section 3: Indices & Sectors (2-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IndicesMacroCard />
        <SectorPerformance />
      </div>

      {/* Section 4: Earnings Hub */}
      <EarningsHub />

      {/* Section 5: Movers & Standouts (2-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopMovers />
        <StandoutsCard />
      </div>

      {/* Section 6: My Watchlist */}
      <MyWatchlist />

      {/* Section 7: Themes & Sectors */}
      <ThemesExplorer />

      {/* Section 8: Tasks & Alerts */}
      <TasksAlertsPreview />
    </div>
  );
}
