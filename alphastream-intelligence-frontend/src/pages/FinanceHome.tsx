import { EarningsHub } from '@/components/finance/EarningsHub';
import { StandoutsCard } from '@/components/finance/StandoutsCard';
import { ThemesExplorer } from '@/components/finance/ThemesExplorer';
import { TopMovers } from '@/components/finance/TopMovers';
import { MacroIndicators } from '@/components/market/MacroIndicators';
import { MacroCharts } from '@/components/market/MacroCharts';
import { IndicesOverview } from '@/components/market/IndicesOverview';
import { SP500Heatmap } from '@/components/finance/SP500Heatmap';
import { MyWatchlist } from '@/components/finance/MyWatchlist';
import { TodaysMarketInsight } from '@/components/finance/TodaysMarketInsight';
import { RecentDevelopments } from '@/components/finance/RecentDevelopments';

export default function FinanceHome() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="mx-auto max-w-[1500px] space-y-5 px-6 py-6">

        {/* Masthead */}
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="font-page-heading text-[34px] font-semibold leading-none text-foreground">
              Market Overview
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A real-time snapshot of indexes, macro, earnings, and the names moving the tape.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-dim">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
            </span>
            <span className="font-semibold uppercase tracking-wide text-sub">Live</span>
            <span>&middot; {today}</span>
          </div>
        </header>

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

        {/* Movers & Standouts */}
        <section>
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
