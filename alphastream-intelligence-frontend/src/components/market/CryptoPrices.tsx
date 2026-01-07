import { useMarket } from '@/context/MarketContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bitcoin } from 'lucide-react';

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

export function CryptoPrices() {
  const { cryptoPrices } = useMarket();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bitcoin className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium">Cryptocurrency</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {cryptoPrices.map((crypto) => (
            <div
              key={crypto.symbol}
              className="p-2.5 rounded-md bg-muted/30 border border-border/50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-semibold text-sm">{crypto.symbol}</span>
                <span
                  className={cn(
                    'font-mono text-xs px-1.5 py-0.5 rounded',
                    crypto.changePercent24h >= 0
                      ? 'text-positive bg-positive/10'
                      : 'text-negative bg-negative/10'
                  )}
                >
                  {crypto.changePercent24h >= 0 ? '+' : ''}
                  {crypto.changePercent24h.toFixed(2)}%
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mb-1">{crypto.name}</div>
              <div className="font-mono text-sm">${formatPrice(crypto.price)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                MCap: {formatMarketCap(crypto.marketCap)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}