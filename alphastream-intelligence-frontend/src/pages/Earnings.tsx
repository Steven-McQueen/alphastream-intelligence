import { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { API_BASE_URL } from '@/config/api';

interface EarningsItem {
  symbol: string;
  date: string;
  company_name: string;
  eps_estimated: number | null;
  eps_actual: number | null;
  revenue_estimated: number | null;
  revenue_actual: number | null;
}

function generateCalendarDays(startDate: Date, days: number = 30) {
  const result = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    result.push({
      date: date.toISOString().split('T')[0],
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      isToday: date.toDateString() === new Date().toDateString(),
    });
  }
  return result;
}

export default function Earnings() {
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earningsSearch, setEarningsSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarStartOffset, setCalendarStartOffset] = useState(0);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setEarningsLoading(true);
        const today = new Date();
        const fromDate = today.toISOString().split('T')[0];
        const toDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const res = await fetch(`${API_BASE_URL}/api/earnings/calendar?from_date=${fromDate}&to_date=${toDate}&limit=500`);
        if (res.ok) {
          const data = await res.json();
          setEarnings(data);
        }
      } catch (err) {
        console.error('Failed to fetch earnings:', err);
      } finally {
        setEarningsLoading(false);
      }
    };
    fetchEarnings();
  }, []);

  const calendarDays = useMemo(() => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + calendarStartOffset);
    return generateCalendarDays(startDate, 14);
  }, [calendarStartOffset]);

  const earningsByDate = useMemo(() => {
    const map: Record<string, EarningsItem[]> = {};
    earnings.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [earnings]);

  const filteredEarnings = useMemo(() => {
    let result = earnings;

    if (earningsSearch) {
      const searchLower = earningsSearch.toLowerCase();
      result = result.filter(e =>
        e.symbol.toLowerCase().includes(searchLower) ||
        e.company_name.toLowerCase().includes(searchLower)
      );
    } else if (selectedDate) {
      result = result.filter(e => e.date === selectedDate);
    }

    return result.slice(0, 50);
  }, [earnings, earningsSearch, selectedDate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-serif)' }}>Earnings Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track upcoming and recent earnings reports
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Header with search */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-foreground">Upcoming Earnings</div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim" />
              <Input
                placeholder="Search company..."
                value={earningsSearch}
                onChange={(e) => {
                  setEarningsSearch(e.target.value);
                  setSelectedDate(null);
                }}
                className="pl-9 w-48 h-9 bg-card border-border text-foreground placeholder:text-dim"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCalendarStartOffset(prev => Math.max(prev - 7, -7))}
                className="p-2 rounded-md bg-card border border-border hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setCalendarStartOffset(0)}
                className="px-3 py-2 rounded-md bg-card border border-border hover:bg-muted text-xs text-muted-foreground"
              >
                Today
              </button>
              <button
                onClick={() => setCalendarStartOffset(prev => prev + 7)}
                className="p-2 rounded-md bg-card border border-border hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        {earningsLoading ? (
          <div className="flex items-center justify-center h-32 text-dim">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading earnings calendar...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const dayEarnings = earningsByDate[day.date] || [];
                const hasEarnings = dayEarnings.length > 0;
                const isSelected = selectedDate === day.date;

                return (
                  <div
                    key={day.date}
                    onClick={() => {
                      setSelectedDate(isSelected ? null : day.date);
                      setEarningsSearch('');
                    }}
                    className={cn(
                      'rounded-xl border p-3 bg-card border-border space-y-1 cursor-pointer transition-all hover:border-secondary',
                      hasEarnings && 'border-positive/50 bg-positive/5',
                      isSelected && 'ring-2 ring-positive border-positive',
                      day.isToday && 'ring-1 ring-blue-500'
                    )}
                  >
                    <div className="text-[10px] text-dim">{day.dayOfWeek}</div>
                    <div className="text-sm font-semibold text-foreground">
                      {day.month} {day.dayOfMonth}
                    </div>
                    {hasEarnings ? (
                      <div className="text-xs text-positive flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dayEarnings.length} {dayEarnings.length === 1 ? 'Report' : 'Reports'}
                      </div>
                    ) : (
                      <div className="text-[10px] text-dim">No Reports</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Date Details or Search Results */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">
                  {earningsSearch
                    ? `Search Results for "${earningsSearch}"`
                    : selectedDate
                      ? `Earnings on ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                      : 'All Upcoming Earnings'}
                </div>
                <div className="text-xs text-dim">{filteredEarnings.length} companies</div>
              </div>

              {filteredEarnings.length === 0 ? (
                <div className="text-sm text-dim text-center py-10">No earnings found</div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-xs text-dim">
                        <th className="text-left px-4 py-2 font-medium">Symbol</th>
                        <th className="text-left px-4 py-2 font-medium">Company</th>
                        <th className="text-left px-4 py-2 font-medium">Date</th>
                        <th className="text-right px-4 py-2 font-medium">Est. EPS</th>
                        <th className="text-right px-4 py-2 font-medium">Est. Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEarnings.map((item, idx) => (
                        <tr key={`${item.symbol}-${item.date}-${idx}`} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <span className="font-mono font-semibold text-foreground">{item.symbol}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                            {item.company_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-soft">
                            {item.eps_estimated !== null ? `$${item.eps_estimated.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-soft">
                            {item.revenue_estimated !== null
                              ? `$${(item.revenue_estimated / 1e9).toFixed(2)}B`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
