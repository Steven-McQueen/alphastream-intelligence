import { EarningsHub } from '@/components/finance/EarningsHub';
import { StandoutsCard } from '@/components/finance/StandoutsCard';
import { ThemesExplorer } from '@/components/finance/ThemesExplorer';
import { TopMovers } from '@/components/TopMovers';
import { MacroIndicators } from '@/components/market/MacroIndicators';
import { MacroCharts } from '@/components/market/MacroCharts';
import { IndicesOverview } from '@/components/market/IndicesOverview';
import { SP500Heatmap } from '@/components/finance/SP500Heatmap';
import { MyWatchlist } from '@/components/MyWatchlist';
import { TodaysMarketInsight } from '@/components/TodaysMarketInsight';
import { RecentDevelopments } from '@/components/finance/RecentDevelopments';

export default function FinanceHome() {
  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-4 space-y-5">

        {/* Index Charts — top of page */}
        <section>
          <IndicesOverview />
        </section>

        {/* Market Insight Banner */}
        <section>
          <TodaysMarketInsight />
        </section>

        {/* Recent Developments */}
        <section>
          <RecentDevelopments />
        </section>

        {/* S&P 500 Heatmap & Macro Indicators */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-1 bg-primary rounded-full" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-serif)' }}>Markets Overview</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SP500Heatmap />
            <MacroIndicators />
          </div>
        </section>

        {/* Macro Charts - Full Width */}
        <section>
          <MacroCharts />
        </section>

        {/* Earnings Calendar - Full Width */}
        <section>
          <EarningsHub />
        </section>

        {/* Secondary Grid: Movers & Standouts */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-1 bg-positive rounded-full" />
            <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-serif)' }}>Today's Activity</h2>
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
