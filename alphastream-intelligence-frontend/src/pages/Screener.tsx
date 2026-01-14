import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Stock, Sector } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  Download, 
  Copy, 
  X, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Loader2,
  Star,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useStockDetail } from '@/contexts/StockDetailContext';
import { useWatchlist } from '@/contexts/WatchlistContext';

const API_BASE_URL = 'http://localhost:8000';

type SortOption = 'ticker' | 'change1D' | 'marketCap' | 'change1Y' | 'price' | 'peRatio' | 'eps' | 'priceToSales' | 'dividendYield' | 'grossMargin' | 'roe' | 'beta' | 'debtToEquity';

// Filter operators
type FilterOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';

interface RatioFilter {
  field: string;
  operator: FilterOperator;
  value: number | null;
  enabled: boolean;
}

// Format large numbers compactly
function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const absValue = Math.abs(value);
  if (absValue >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString();
}

// Format percentage
function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// Format ratio
function formatRatio(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return value.toFixed(decimals);
}

// Available ratio columns
const RATIO_COLUMNS = [
  { key: 'peRatio', label: 'P/E', format: (v: number) => formatRatio(v) },
  { key: 'eps', label: 'EPS', format: (v: number) => `$${formatRatio(v, 2)}` },
  { key: 'priceToSales', label: 'P/S', format: (v: number) => formatRatio(v, 2) },
  { key: 'dividendYield', label: 'Div%', format: (v: number) => `${formatRatio(v * 100)}%` },
  { key: 'grossMargin', label: 'Gross%', format: (v: number) => `${formatRatio(v * 100)}%` },
  { key: 'roe', label: 'ROE', format: (v: number) => `${formatRatio(v * 100)}%` },
  { key: 'beta', label: 'Beta', format: (v: number) => formatRatio(v, 2) },
  { key: 'debtToEquity', label: 'D/E', format: (v: number) => formatRatio(v, 2) },
];

// Filter options UI
function FilterRow({ 
  filter, 
  onChange, 
  onRemove 
}: { 
  filter: RatioFilter; 
  onChange: (f: RatioFilter) => void; 
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-lg">
      <Select 
        value={filter.field} 
        onValueChange={(v) => onChange({ ...filter, field: v })}
      >
        <SelectTrigger className="w-28 h-8 text-xs bg-zinc-900 border-zinc-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-700">
          <SelectItem value="peRatio">P/E Ratio</SelectItem>
          <SelectItem value="eps">EPS</SelectItem>
          <SelectItem value="priceToSales">P/S Ratio</SelectItem>
          <SelectItem value="dividendYield">Dividend %</SelectItem>
          <SelectItem value="grossMargin">Gross Margin</SelectItem>
          <SelectItem value="roe">ROE</SelectItem>
          <SelectItem value="beta">Beta</SelectItem>
          <SelectItem value="debtToEquity">Debt/Equity</SelectItem>
          <SelectItem value="marketCap">Market Cap</SelectItem>
        </SelectContent>
      </Select>
      
      <Select 
        value={filter.operator} 
        onValueChange={(v) => onChange({ ...filter, operator: v as FilterOperator })}
      >
        <SelectTrigger className="w-16 h-8 text-xs bg-zinc-900 border-zinc-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-700">
          <SelectItem value="gt">&gt;</SelectItem>
          <SelectItem value="gte">≥</SelectItem>
          <SelectItem value="lt">&lt;</SelectItem>
          <SelectItem value="lte">≤</SelectItem>
          <SelectItem value="eq">=</SelectItem>
        </SelectContent>
      </Select>
      
      <Input
        type="number"
        value={filter.value ?? ''}
        onChange={(e) => onChange({ ...filter, value: e.target.value ? parseFloat(e.target.value) : null })}
        className="w-20 h-8 text-xs bg-zinc-900 border-zinc-700"
        placeholder="Value"
      />
      
      <button 
        onClick={onRemove}
        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Screener() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<Sector[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('marketCap');
  const [sortAsc, setSortAsc] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [ratioFilters, setRatioFilters] = useState<RatioFilter[]>([]);
  const pageSize = 50; // 50 rows per page
  
  const { openStockDetail } = useStockDetail();
  const { watchlist, toggleWatchlist } = useWatchlist();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/universe/core`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStocks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Backend error:', err);
        setError('Could not connect to backend. Make sure it is running on port 8000.');
        setLoading(false);
      });
  }, []);

  // Handle URL params for stock detail
  useEffect(() => {
    const stockParam = searchParams.get('stock');
    if (stockParam && stocks.length) {
      const stock = stocks.find((s) => s.ticker === stockParam);
      if (stock) {
        openStockDetail(stock);
        setSearchParams({});
      }
    }
  }, [searchParams, stocks, setSearchParams, openStockDetail]);

  // Handle URL params for sector and filters from ThemesExplorer
  useEffect(() => {
    const sectorParam = searchParams.get('sector');
    const filtersParam = searchParams.get('filters');
    
    let hasChanges = false;
    
    if (sectorParam) {
      setSelectedSectors([sectorParam as Sector]);
      hasChanges = true;
    }
    
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam);
        if (Array.isArray(parsedFilters)) {
          const newFilters: RatioFilter[] = parsedFilters.map((f: any) => ({
            field: f.field || 'peRatio',
            operator: f.operator || 'lt',
            value: f.value !== undefined ? f.value : null,
            enabled: true,
          }));
          setRatioFilters(newFilters);
          setShowFilters(true);
          hasChanges = true;
        }
      } catch (err) {
        console.error('Error parsing filters from URL:', err);
      }
    }
    
    // Clear URL params after applying
    if (hasChanges) {
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const sectors = useMemo(() => {
    const unique = new Set<Sector>();
    stocks.forEach((s) => unique.add(s.sector));
    return Array.from(unique).sort();
  }, [stocks]);

  // Apply ratio filters
  const applyRatioFilter = (stock: Stock, filter: RatioFilter): boolean => {
    if (!filter.enabled || filter.value === null) return true;
    
    const stockValue = (stock as Record<string, any>)[filter.field];
    if (stockValue === null || stockValue === undefined) return false;
    
    switch (filter.operator) {
      case 'gt': return stockValue > filter.value;
      case 'gte': return stockValue >= filter.value;
      case 'lt': return stockValue < filter.value;
      case 'lte': return stockValue <= filter.value;
      case 'eq': return Math.abs(stockValue - filter.value) < 0.01;
      default: return true;
    }
  };

  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    // Text search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.ticker.toLowerCase().includes(searchLower) ||
          s.name.toLowerCase().includes(searchLower)
      );
    }

    // Sector filter
    if (selectedSectors.length > 0) {
      result = result.filter((s) => selectedSectors.includes(s.sector));
    }

    // Ratio filters
    ratioFilters.forEach(filter => {
      if (filter.enabled && filter.value !== null) {
        result = result.filter(stock => applyRatioFilter(stock, filter));
      }
    });

    // Sort
    result.sort((a, b) => {
      const safe = (v?: number | null) => (Number.isFinite(v as number) ? (v as number) : 0);
      let comparison = 0;
      
      switch (sortBy) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'change1D':
          comparison = safe(b.change1D) - safe(a.change1D);
          break;
        case 'marketCap':
          comparison = safe(b.marketCap) - safe(a.marketCap);
          break;
        case 'change1Y':
          comparison = safe(b.change1Y) - safe(a.change1Y);
          break;
        case 'price':
          comparison = safe(b.price) - safe(a.price);
          break;
        case 'peRatio':
          comparison = safe(a.peRatio) - safe(b.peRatio);
          break;
        case 'eps':
          comparison = safe(b.eps) - safe(a.eps);
          break;
        case 'dividendYield':
          comparison = safe(b.dividendYield) - safe(a.dividendYield);
          break;
        case 'grossMargin':
          comparison = safe(b.grossMargin) - safe(a.grossMargin);
          break;
        case 'roe':
          comparison = safe(b.roe) - safe(a.roe);
          break;
        case 'beta':
          comparison = safe(a.beta) - safe(b.beta);
          break;
        default:
          comparison = 0;
      }
      
      return sortAsc ? -comparison : comparison;
    });

    return result;
  }, [stocks, search, selectedSectors, sortBy, sortAsc, ratioFilters]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, selectedSectors, sortBy, ratioFilters]);

  const paginatedStocks = useMemo(() => {
    const start = page * pageSize;
    return filteredStocks.slice(start, start + pageSize);
  }, [filteredStocks, page]);

  const totalPages = Math.ceil(filteredStocks.length / pageSize);

  const handleRowClick = (stock: Stock) => {
    openStockDetail(stock);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedSectors([]);
    setRatioFilters([]);
  };

  const addRatioFilter = () => {
    setRatioFilters(prev => [...prev, { 
      field: 'peRatio', 
      operator: 'lt', 
      value: null, 
      enabled: true 
    }]);
  };

  const handleExportCSV = () => {
    const headers = ['Ticker', 'Name', 'Sector', 'Price', '1D%', '1Y%', 'Mkt Cap', 'P/E', 'EPS', 'Div%', 'Gross%', 'ROE', 'Beta'];
    const rows = filteredStocks.map((s) => [
      s.ticker,
      s.name,
      s.sector,
      (s.price ?? 0).toFixed(2),
      (s.change1D ?? 0).toFixed(2),
      (s.change1Y ?? 0).toFixed(2),
      (s.marketCap ?? 0).toFixed(0),
      (s.peRatio ?? 0).toFixed(1),
      (s.eps ?? 0).toFixed(2),
      ((s.dividendYield ?? 0) * 100).toFixed(2),
      ((s.grossMargin ?? 0) * 100).toFixed(1),
      ((s.roe ?? 0) * 100).toFixed(1),
      (s.beta ?? 0).toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screener-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exported',
      description: `${filteredStocks.length} stocks exported to CSV`,
    });
  };

  const handleCopyTickers = () => {
    const tickers = filteredStocks.map((s) => s.ticker).join(', ');
    navigator.clipboard.writeText(tickers);
    toast({
      title: 'Copied',
      description: `${filteredStocks.length} tickers copied to clipboard`,
    });
  };

  const hasFilters = search || selectedSectors.length > 0 || ratioFilters.some(f => f.enabled && f.value !== null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0b]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <div className="text-lg text-zinc-400">Loading stocks...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0b]">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0b]">
      {/* Compact Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Stock Screener</h1>
            <p className="text-xs text-zinc-500">Browse and filter equities</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300" 
              onClick={handleCopyTickers}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300" 
              onClick={handleExportCSV}
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Compact Toolbar */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[150px] max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
            />
          </div>

          {/* Sector Filter */}
          <Select 
            value={selectedSectors.length === 1 ? selectedSectors[0] : "all"} 
            onValueChange={(v) => setSelectedSectors(v && v !== "all" ? [v as Sector] : [])}
          >
            <SelectTrigger className="w-32 h-7 text-xs bg-zinc-900 border-zinc-800 text-white">
              <Filter className="h-3 w-3 mr-1 text-zinc-500" />
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Sectors</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector} value={sector}>
                  {sector}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-28 h-7 text-xs bg-zinc-900 border-zinc-800 text-white">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="marketCap">Mkt Cap</SelectItem>
              <SelectItem value="change1D">1D Change</SelectItem>
              <SelectItem value="change1Y">1Y Change</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="peRatio">P/E</SelectItem>
              <SelectItem value="eps">EPS</SelectItem>
              <SelectItem value="dividendYield">Dividend</SelectItem>
              <SelectItem value="roe">ROE</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="ticker">Ticker</SelectItem>
            </SelectContent>
          </Select>

          {/* Add Filter Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-3 w-3 mr-1" />
            Filters {ratioFilters.filter(f => f.enabled && f.value !== null).length > 0 && `(${ratioFilters.filter(f => f.enabled && f.value !== null).length})`}
          </Button>

          {/* Clear Filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-zinc-400 hover:text-white"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}

          <div className="flex-1" />

          {/* Count */}
          <span className="text-xs text-zinc-500">
            {filteredStocks.length} stocks
          </span>
        </div>

        {/* Ratio Filters Panel */}
        {showFilters && (
          <div className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400">Ratio Filters</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-emerald-400 hover:text-emerald-300"
                onClick={addRatioFilter}
              >
                + Add Filter
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ratioFilters.map((filter, idx) => (
                <FilterRow
                  key={idx}
                  filter={filter}
                  onChange={(f) => {
                    const newFilters = [...ratioFilters];
                    newFilters[idx] = f;
                    setRatioFilters(newFilters);
                  }}
                  onRemove={() => {
                    setRatioFilters(ratioFilters.filter((_, i) => i !== idx));
                  }}
                />
              ))}
              {ratioFilters.length === 0 && (
                <p className="text-xs text-zinc-500 italic">No filters. Click "Add Filter" to create one.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compact Data Table */}
      <div className="flex-1 px-4 pb-2 overflow-hidden">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden h-full flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-800 border-b border-zinc-700">
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-zinc-500 uppercase w-6"></th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-zinc-500 uppercase">Ticker</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-zinc-500 uppercase max-w-[120px]">Company</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-zinc-500 uppercase">Sector</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">Price</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">1D</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">1Y</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">Mkt Cap</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">P/E</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">EPS</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">Div%</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">Gross%</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">ROE</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-zinc-500 uppercase">Beta</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStocks.map((stock) => {
                  const isWatched = watchlist.includes(stock.ticker);
                  const change1D = stock.change1D ?? 0;
                  const change1Y = stock.change1Y ?? 0;
                  
                  return (
                    <tr
                      key={stock.ticker}
                      onClick={() => handleRowClick(stock)}
                      className="border-b border-zinc-800/30 hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-2 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(stock.ticker);
                          }}
                          className="opacity-40 group-hover:opacity-100 transition-opacity"
                        >
                          <Star className={cn(
                            "w-3 h-3",
                            isWatched ? "fill-yellow-500 text-yellow-500" : "text-zinc-600 hover:text-yellow-500"
                          )} />
                        </button>
                      </td>
                      <td className="px-2 py-1">
                        <span className="font-semibold text-white">{stock.ticker}</span>
                      </td>
                      <td className="px-2 py-1 text-zinc-400 max-w-[120px] truncate">
                        {stock.name}
                      </td>
                      <td className="px-2 py-1">
                        <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {stock.sector?.split(' ')[0] || '-'}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-white">
                        ${(stock.price ?? 0).toFixed(2)}
                      </td>
                      <td className={cn(
                        "px-2 py-1 text-right font-mono",
                        change1D >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        <span className="inline-flex items-center gap-0.5">
                          {change1D >= 0 ? (
                            <TrendingUp className="w-2.5 h-2.5" />
                          ) : (
                            <TrendingDown className="w-2.5 h-2.5" />
                          )}
                          {formatPct(change1D)}
                        </span>
                      </td>
                      <td className={cn(
                        "px-2 py-1 text-right font-mono",
                        change1Y >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {formatPct(change1Y)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-300">
                        ${formatCompact(stock.marketCap ?? 0)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-300">
                        {formatRatio(stock.peRatio)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-300">
                        ${formatRatio(stock.eps, 2)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-300">
                        {stock.dividendYield ? `${formatRatio((stock.dividendYield ?? 0) * 100)}%` : '-'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-300">
                        {stock.grossMargin ? `${formatRatio((stock.grossMargin ?? 0) * 100)}%` : '-'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-300">
                        {stock.roe ? `${formatRatio((stock.roe ?? 0) * 100)}%` : '-'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-300">
                        {formatRatio(stock.beta, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Compact Pagination */}
      {totalPages > 1 && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredStocks.length)} of {filteredStocks.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="h-6 w-6 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-6 w-6 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="px-2 text-xs text-zinc-400">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-6 w-6 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="h-6 w-6 p-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30"
              >
                »
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
