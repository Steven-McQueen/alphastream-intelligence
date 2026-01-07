import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import type { Trade } from '@/types';

interface TradeSuggestionsProps {
  trades: Trade[];
  onRefresh: () => void;
}

export function TradeSuggestions({ trades, onRefresh }: TradeSuggestionsProps) {
  const buyTrades = trades.filter((t) => t.action === 'BUY');
  const sellTrades = trades.filter((t) => t.action === 'SELL');
  
  const totalBuyValue = buyTrades.reduce((sum, t) => sum + t.estimatedValue, 0);
  const totalSellValue = sellTrades.reduce((sum, t) => sum + t.estimatedValue, 0);
  const netCashFlow = totalSellValue - totalBuyValue;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Rebalancing Trades</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Recalculate
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-secondary/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Buys</p>
            <p className="text-sm font-semibold text-emerald-500">
              ${totalBuyValue.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Sells</p>
            <p className="text-sm font-semibold text-red-500">
              ${totalSellValue.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Net Cash Flow</p>
            <p className={`text-sm font-semibold ${netCashFlow >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {netCashFlow >= 0 ? '+' : ''}${netCashFlow.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-200">
            These are suggested trades based on optimization. Review carefully before executing. 
            Tax implications and transaction costs not included.
          </p>
        </div>

        {/* Trade list */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {trades.map((trade, index) => (
            <div
              key={`${trade.ticker}-${index}`}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded ${trade.action === 'BUY' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  {trade.action === 'BUY' ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{trade.ticker}</span>
                    <Badge
                      variant={trade.action === 'BUY' ? 'default' : 'destructive'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {trade.action}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{trade.name}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-medium">
                  {trade.shares} shares
                </p>
                <p className="text-xs text-muted-foreground">
                  ${trade.estimatedValue.toLocaleString()}
                </p>
              </div>

              <div className="text-right w-24">
                <p className="text-xs text-muted-foreground">Weight Change</p>
                <p className="text-sm font-mono">
                  {trade.currentWeight.toFixed(1)}% → {trade.targetWeight.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button variant="outline" className="flex-1">
            Save as Strategy
          </Button>
          <Button className="flex-1">
            Review & Execute
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
