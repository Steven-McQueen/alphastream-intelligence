import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { cn } from '@/lib/utils';

interface CongressTrade {
  firstName: string;
  lastName: string;
  symbol: string;
  type: string;
  amount: string;
  transactionDate: string;
  disclosureDate: string;
  district?: string;
  office?: string;
  assetDescription?: string;
  link?: string;
}

export default function Politicians() {
  const [trades, setTrades] = useState<CongressTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/congress/trades/recent?limit=`);
        if (res.ok) {
          const data = await res.json();
          setTrades(data);
        }
      } catch (err) {
        console.error('Failed to fetch congress trades:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrades();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-serif)' }}>
            Congressional Trading Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track recent stock trades by members of Congress
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-dim">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading congressional trades...
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-dim">
            No recent trades available
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-card">
                  <tr className="text-xs text-dim">
                    <th className="text-left px-4 py-3 font-medium">Politician</th>
                    <th className="text-left px-4 py-3 font-medium">Symbol</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Transaction</th>
                    <th className="text-left px-4 py-3 font-medium">Disclosed</th>
                    <th className="text-left px-4 py-3 font-medium">Delay</th>
                    <th className="text-right px-4 py-3 font-medium">Filing</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, idx) => {
                    const isBuy =
                      trade.type?.toLowerCase().includes('purchase') ||
                      trade.type?.toLowerCase().includes('buy');
                    const discrepancyDays =
                      trade.disclosureDate && trade.transactionDate
                        ? Math.floor(
                            (new Date(trade.disclosureDate).getTime() -
                              new Date(trade.transactionDate).getTime()) /
                              (1000 * 60 * 60 * 24)
                          )
                        : null;

                    return (
                      <tr
                        key={`${trade.symbol}-${trade.disclosureDate}-${idx}`}
                        className="border-b border-border hover:bg-card/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground text-sm">
                            {trade.firstName} {trade.lastName}
                          </div>
                          <div className="text-xs text-dim">
                            {trade.district || trade.office}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-foreground">{trade.symbol}</div>
                          <div className="text-xs text-dim truncate max-w-[120px]">
                            {trade.assetDescription}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1',
                              isBuy
                                ? 'bg-positive/20 text-positive'
                                : 'bg-negative/20 text-negative'
                            )}
                          >
                            {isBuy ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {trade.type
                              ?.replace('(Full)', '')
                              .replace('(Partial)', '')
                              .trim()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-soft">
                          {trade.amount || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {trade.transactionDate || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {trade.disclosureDate || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {discrepancyDays !== null && discrepancyDays > 0 && (
                            <span
                              className={cn(
                                'text-xs px-2 py-1 rounded-full',
                                discrepancyDays > 30
                                  ? 'bg-negative/20 text-negative'
                                  : discrepancyDays > 14
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-secondary text-muted-foreground'
                              )}
                            >
                              +{discrepancyDays}d
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {trade.link && (
                            <a
                              href={trade.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
