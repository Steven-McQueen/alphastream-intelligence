import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PerplexityChatInput } from '@/components/ui/PerplexityChatInput';
import { cn } from '@/lib/utils';
import { getSuggestedPrompts } from '@/data/mockFinanceHome';
import { useMarket } from '@/context/MarketContext';
import { useMarketIndices, useUS10Y, useVIX } from '@/hooks/useMarketIndices';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function HeroSection() {
  const navigate = useNavigate();
  const { marketState } = useMarket();
  const suggestedPrompts = getSuggestedPrompts();
  const queryClient = useQueryClient();
  const { data: indices, isLoading: indicesLoading } = useMarketIndices();
  const { data: us10y, isLoading: us10yLoading } = useUS10Y();
  const { data: vix, isLoading: vixLoading } = useVIX();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['marketIndices'] });
    queryClient.invalidateQueries({ queryKey: ['us10y'] });
    queryClient.invalidateQueries({ queryKey: ['vix'] });
  };

  const snapshotIndices = useMemo(() => {
    const order = ['SPX', 'NDX', 'DJI', 'RUT'];
    return order.map((symbol) => (indices || []).find((item) => item.symbol === symbol));
  }, [indices]);

  const macroEntries = useMemo(() => {
    const entries: {
      label: string;
      value: string;
      change: number;
      color: string;
    }[] = [];

    if (us10y) {
      const changeValue = us10y.change ?? 0;
      entries.push({
        label: 'US10Y',
        value: `${us10y.value?.toFixed(2) ?? '—'}%`,
        change: changeValue,
        color: changeValue >= 0 ? 'text-positive' : 'text-negative',
      });
    }

    if (vix) {
      const changeValue = vix.change ?? 0;
      entries.push({
        label: 'VIX',
        value: vix.value?.toFixed(2) ?? '—',
        change: changeValue,
        color: changeValue >= 0 ? 'text-negative' : 'text-positive',
      });
    }

    return entries;
  }, [us10y, vix]);

  const isLoadingSnapshot = indicesLoading || us10yLoading || vixLoading;

  const handleSubmit = (promptText?: string) => {
    const searchQuery = promptText;
    if (searchQuery && searchQuery.trim()) {
      navigate(`/intelligence?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const getSentimentColor = () => {
    switch (marketState.regime) {
      case 'Risk-On':
        return 'bg-positive/20 text-positive border-positive/30';
      case 'Risk-Off':
        return 'bg-negative/20 text-negative border-negative/30';
      default:
        return 'bg-warning/20 text-warning border-warning/30';
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-950/80 border border-zinc-800/50 overflow-hidden">
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Brand & Query */}
          <div className="lg:col-span-3 space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                AlphaStream
              </h1>
              <p className="text-muted-foreground text-base max-w-xl">
                Your AI-powered financial intelligence platform. Ask anything about markets, stocks, or your portfolio.
              </p>
            </div>

            <div className="space-y-3">
              <PerplexityChatInput
                onSubmit={(text) => handleSubmit(text)}
                placeholder="Ask about markets, sectors, or any stock..."
              />
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-zinc-800 transition-colors border-zinc-700"
                    onClick={() => handleSubmit(prompt.prompt)}
                  >
                    {prompt.text}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Market Snapshot */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-foreground">Live Markets</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px] border-zinc-700', getSentimentColor())}>
                    {marketState.regime}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoadingSnapshot}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSnapshot ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {isLoadingSnapshot && (
                <div className="text-xs text-muted-foreground">Loading...</div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {['SPX', 'NDX', 'DJI', 'RUT'].map((symbol, idx) => {
                  const item = snapshotIndices[idx];
                  const changePercent = item?.changePercent ?? 0;
                  return (
                    <div
                      key={symbol}
                      className="bg-zinc-800/40 rounded-lg p-3 hover:bg-zinc-800/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-zinc-400">{symbol}</span>
                        <span
                          className={cn(
                            'text-[10px] font-mono px-1.5 py-0.5 rounded',
                            changePercent >= 0
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                        </span>
                      </div>

                      <div className="text-base font-mono font-semibold text-foreground">
                        {!isLoadingSnapshot && item?.value !== undefined
                          ? item.value.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-zinc-800/50">
                <div className="grid grid-cols-2 gap-3">
                  {macroEntries.map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{entry.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono">{entry.value}</span>
                        <span className={cn('font-mono', entry.color)}>
                          {entry.change >= 0 ? '+' : ''}
                          {entry.change.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
