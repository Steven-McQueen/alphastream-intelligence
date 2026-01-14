import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, ExternalLink, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const API_BASE_URL = 'http://localhost:8000';

interface CongressTrade {
  symbol: string;
  disclosureDate: string;
  transactionDate: string;
  firstName: string;
  lastName: string;
  office: string;
  district: string;
  owner: string;
  assetDescription: string;
  assetType: string;
  type: string;
  amount: string;
  capitalGainsOver200USD: string;
  link: string;
}

interface PoliticianTradesProps {
  ticker: string;
}

// Calculate days between dates
function daysBetween(date1: string, date2: string): number {
  if (!date1 || !date2) return 0;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Format date nicely
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function PoliticianTrades({ ticker }: PoliticianTradesProps) {
  const [trades, setTrades] = useState<CongressTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      if (!ticker) return;
      
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/congress/trades/${encodeURIComponent(ticker)}?limit=100`);
        
        if (!res.ok) {
          throw new Error('Failed to fetch congress trades');
        }
        
        const data = await res.json();
        setTrades(data || []);
      } catch (err) {
        console.error('Error fetching congress trades:', err);
        setError('Failed to load congressional trading data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTrades();
  }, [ticker]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm text-zinc-400">Loading congressional trades...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <Users className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <Users className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-lg font-medium text-white mb-2">No Congressional Trades</p>
          <p className="text-sm text-zinc-400">No recent trades found for {ticker}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Politicians Trading {ticker}</h3>
          <p className="text-sm text-zinc-400">{trades.length} trades found</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-900">
              <tr className="text-xs text-zinc-500">
                <th className="text-left px-4 py-3 font-medium">Politician</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Transaction</th>
                <th className="text-left px-4 py-3 font-medium">Disclosed</th>
                <th className="text-left px-4 py-3 font-medium">Delay</th>
                <th className="text-right px-4 py-3 font-medium">View</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, idx) => {
                const isBuy = trade.type?.toLowerCase().includes('purchase') || trade.type?.toLowerCase().includes('buy');
                const discrepancyDays = daysBetween(trade.transactionDate, trade.disclosureDate);

                return (
                  <tr
                    key={`${trade.symbol}-${trade.disclosureDate}-${trade.firstName}-${idx}`}
                    className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white text-sm">
                        {trade.firstName} {trade.lastName}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {trade.district || trade.office}
                        {trade.owner && trade.owner !== '' && ` (${trade.owner})`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn(
                        'text-xs font-medium',
                        isBuy 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      )}>
                        {isBuy ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        {trade.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-300">
                      {trade.amount || 'Not disclosed'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(trade.transactionDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(trade.disclosureDate)}
                    </td>
                    <td className="px-4 py-3">
                      {discrepancyDays > 0 && (
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          discrepancyDays > 30 
                            ? 'bg-red-500/20 text-red-400' 
                            : discrepancyDays > 14 
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-zinc-700 text-zinc-400'
                        )}>
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
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Filing
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-1">Total Trades</div>
          <div className="text-xl font-bold text-white">{trades.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-1">Purchases</div>
          <div className="text-xl font-bold text-emerald-400">
            {trades.filter(t => t.type?.toLowerCase().includes('purchase') || t.type?.toLowerCase().includes('buy')).length}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-1">Sales</div>
          <div className="text-xl font-bold text-red-400">
            {trades.filter(t => t.type?.toLowerCase().includes('sale') || t.type?.toLowerCase().includes('sell')).length}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-1">Unique Politicians</div>
          <div className="text-xl font-bold text-white">
            {new Set(trades.map(t => `${t.firstName} ${t.lastName}`)).size}
          </div>
        </div>
      </div>
    </div>
  );
}
