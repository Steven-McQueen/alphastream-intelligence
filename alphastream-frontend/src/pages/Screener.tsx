import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  Loader2,
  Star,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useStockDetail } from '@/contexts/StockDetailContext';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { API_BASE_URL } from '@/config/api';

interface SymbolResult {
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  is_sp500: boolean;
  exchange: string | null;
}

interface DirectoryEntry {
  ticker: string;
  name: string;
}

function toDirectoryStub(entry: DirectoryEntry): Stock {
  return {
    ticker: entry.ticker,
    name: entry.name,
    sector: '' as Sector,
    industry: '',
    price: 0,
    change1D: 0,
    change1W: 0,
    change1M: 0,
    change1Y: 0,
    volume: 0,
    peRatio: null,
    marketCap: 0,
    dataSource: 'directory',
  };
}

type SortOption = 'ticker' |  'marketCap' |  'price' | 'dividendYield' | 'beta';

// Filter operators
type FilterOperator = 'gt' | 'lt' ;

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

// NaN ?? 0 is still NaN, so never call toFixed on a raw price.
function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `$${value.toFixed(2)}`;
}

function formatRatio(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return value.toFixed(decimals);
}

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
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Select 
        value={filter.field} 
        onValueChange={(v) => onChange({ ...filter, field: v })}
      >
        <SelectTrigger className="w-28 h-8 text-xs bg-card border-secondary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-secondary">
          <SelectItem value="marketCap">Market Cap</SelectItem>
          <SelectItem value="volume">Volume</SelectItem>
          <SelectItem value="beta">Beta</SelectItem>
          <SelectItem value="dividendYield">Dividend %</SelectItem>
          <SelectItem value="price">Price</SelectItem>
        </SelectContent>
      </Select>
      
      <Select
        value={filter.operator}
        onValueChange={(v) => onChange({ ...filter, operator: v as FilterOperator })}
      >
        <SelectTrigger className="w-16 h-8 text-xs bg-card border-secondary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-secondary">
          <SelectItem value="gt">&gt;</SelectItem>
          <SelectItem value="lt">&lt;</SelectItem>
        </SelectContent>
      </Select>
      
      <Input
        type="number"
        value={filter.value ?? ''}
        onChange={(e) => onChange({ ...filter, value: e.target.value ? parseFloat(e.target.value) : null })}
        className="w-20 h-8 text-xs bg-card border-secondary"
        placeholder="Value"
      />
      
      <button 
        onClick={onRemove}
        className="p-1 text-dim hover:text-negative transition-colors"
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
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('marketCap');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [ratioFilters, setRatioFilters] = useState<RatioFilter[]>([]);
  const pageSize = 50; // 50 rows per page
  
  const { openStockDetail, subscribeToStockUpdates } = useStockDetail();
  const { watchlist, toggleWatchlist } = useWatchlist();

  // Symbol search state (for searching full 24k universe)
  const [symbolResults, setSymbolResults] = useState<SymbolResult[]>([]);
  const [searchingSymbols, setSearchingSymbols] = useState(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced symbol search
  const searchSymbols = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSymbolResults([]);
      setShowSymbolDropdown(false);
      return;
    }
    setSearchingSymbols(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/universe/search-symbols?q=${encodeURIComponent(query)}&limit=15`);
      if (res.ok) {
        const data: SymbolResult[] = await res.json();
        setSymbolResults(data);
        setShowSymbolDropdown(data.length > 0);
      }
    } catch (err) {
      console.error('Symbol search error:', err);
    } finally {
      setSearchingSymbols(false);
    }
  }, []);

  // Debounce timer ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Handle search input change with debounce
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSymbols(value), 300);
  };

  // Handle clicking a symbol from dropdown
  const handleSymbolSelect = (symbol: SymbolResult) => {
    setShowSymbolDropdown(false);
    setSearch('');
    // Create a minimal Stock object and open detail
    const stockObj = {
      ticker: symbol.ticker,
      name: symbol.name,
      sector: (symbol.sector || 'Unknown') as Sector,
      industry: symbol.industry || '',
      price: 0,
      marketCap: 0,
    } as Stock;
    openStockDetail(stockObj);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSymbolDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [filtersApplied, setFiltersApplied] = useState(false);

  // Load initial data from cached database (fast, no FMP call)
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [coreRes, dirRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/universe/core`),
        fetch(`${API_BASE_URL}/api/universe/directory`),
      ]);
      if (!coreRes.ok) throw new Error('Failed to load stocks');
      const data = await coreRes.json();
      const rows = Array.isArray(data) ? data : [];
      setStocks(rows.slice(0, 600));

      if (dirRes.ok) {
        const dir = await dirRes.json();
        const items: DirectoryEntry[] = Array.isArray(dir?.items) ? dir.items : [];
        setDirectory(items);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Could not connect to backend. Make sure it is running on port 8000.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply filters using FMP company-screener endpoint
  // ONLY called when user clicks "Apply Filters" button
  const applyFiltersFromFMP = useCallback(async () => {
    setLoading(true);
    setFiltersApplied(true);
    try {
      const params = new URLSearchParams();

      // Add sector filter if selected
      if (selectedSectors.length > 0) {
        params.set('sector', selectedSectors[0]);
      }

      // Add industry filter if selected
      if (selectedIndustry) {
        params.set('industry', selectedIndustry);
      }

      // Add ratio filters that are enabled
      ratioFilters.forEach(filter => {
        if (filter.enabled && filter.value !== null) {
          const paramMap: Record<string, [string, string]> = {
            beta: ['betaMoreThan', 'betaLowerThan'],
            marketCap: ['marketCapMoreThan', 'marketCapLowerThan'],
            dividendYield: ['dividendMoreThan', 'dividendLowerThan'],
            volume: ['volumeMoreThan', 'volumeLowerThan'],
            price: ['priceMoreThan', 'priceLowerThan'],
          };
          const [gtParam, ltParam] = paramMap[filter.field] || [];
          if (gtParam && ltParam) {
            params.set(filter.operator === 'gt' ? gtParam : ltParam, filter.value.toString());
          }
        }
      });

      // Max 1000 results from FMP company-screener
      params.set('limit', '1000');

      const response = await fetch(`${API_BASE_URL}/api/screener?${params}`);
      if (!response.ok) throw new Error('Server screener failed');

      const data = await response.json();
      setStocks(data.items || []);
      setDirectory([]);
      setPage(0);
      toast({
        title: 'Filters Applied',
        description: `Found ${data.items?.length || 0} stocks matching your criteria`,
      });
    } catch (err) {
      console.error('Screener error:', err);
      toast({
        title: 'Filter Error',
        description: 'Failed to apply filters. Try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedSectors, selectedIndustry, ratioFilters]);

  // Initial load from cached database (NOT FMP screener)
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Directory import runs in the background on startup; pick it up when it lands.
  useEffect(() => {
    if (directory.length >= 5000) return;
    let attempts = 0;
    const id = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 24) {
        window.clearInterval(id);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/universe/directory`);
        if (!res.ok) return;
        const dir = await res.json();
        const items: DirectoryEntry[] = Array.isArray(dir?.items) ? dir.items : [];
        if (items.length > 0) {
          setDirectory(items);
          if (items.length >= 5000) window.clearInterval(id);
        }
      } catch {
        // keep polling
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [directory.length]);

  // Subscribe to stock updates from StockDetailSheet
  // When user closes the detail sheet, update that stock's price in our list
  useEffect(() => {
    const unsubscribe = subscribeToStockUpdates((updatedStock) => {
      setStocks(prev => prev.map(s =>
        s.ticker === updatedStock.ticker ? { ...s, ...updatedStock } : s
      ));
    });
    return unsubscribe;
  }, [subscribeToStockUpdates]);

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
            field: f.field || 'marketCap',
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
    const unique = new Set<string>();
    stocks.forEach((s) => {
      if (s.sector && String(s.sector).trim()) unique.add(s.sector);
    });
    return Array.from(unique).sort() as Sector[];
  }, [stocks]);

  const industries = useMemo(() => {
    const unique = new Set<string>();
    stocks.forEach((s) => {
      if (s.industry && s.industry.trim() !== '') {
        unique.add(s.industry);
      }
    });
    return Array.from(unique).sort();
  }, [stocks]);

  // Apply ratio filters (only gt/lt operators)
  const applyRatioFilter = (stock: Stock, filter: RatioFilter): boolean => {
    if (!filter.enabled || filter.value === null) return true;
    const stockValue = (stock as Record<string, any>)[filter.field];
    if (stockValue === null || stockValue === undefined) return false;
    return filter.operator === 'gt' ? stockValue > filter.value : stockValue < filter.value;
  };

  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    // Text search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.ticker || '').toLowerCase().includes(searchLower) ||
          (s.name || '').toLowerCase().includes(searchLower)
      );
    }

    // Sector filter
    if (selectedSectors.length > 0) {
      result = result.filter((s) => selectedSectors.includes(s.sector));
    }

    // Industry filter
    if (selectedIndustry) {
      result = result.filter((s) => s.industry === selectedIndustry);
    }

    // Ratio filters
    ratioFilters.forEach(filter => {
      if (filter.enabled && filter.value !== null) {
        result = result.filter(stock => applyRatioFilter(stock, filter));
      }
    });

    // Sort (descending by default, except ticker which is alphabetical)
    result.sort((a, b) => {
      const safe = (v?: number | null) => (Number.isFinite(v as number) ? (v as number) : 0);
      switch (sortBy) {
        case 'ticker': return a.ticker.localeCompare(b.ticker);
        case 'marketCap': return safe(b.marketCap) - safe(a.marketCap);
        case 'price': return safe(b.price) - safe(a.price);
        case 'dividendYield': return safe(b.dividendYield) - safe(a.dividendYield);
        case 'beta': return safe(a.beta) - safe(b.beta);
        default: return 0;
      }
    });

    return result;
  }, [stocks, search, selectedSectors, selectedIndustry, sortBy, ratioFilters]);

  const coreTickers = useMemo(
    () => new Set(stocks.map((s) => (s.ticker || '').toUpperCase())),
    [stocks]
  );

  const numericFiltersActive =
    selectedSectors.length > 0 ||
    !!selectedIndustry ||
    ratioFilters.some((f) => f.enabled && f.value !== null);

  // Names not in the S&P snapshot. Hidden when ratio/sector filters are on
  // because those rows have no fundamentals yet.
  const filteredDirectory = useMemo(() => {
    if (filtersApplied || numericFiltersActive) return [];
    let rows = directory.filter((d) => !coreTickers.has((d.ticker || '').toUpperCase()));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (d) =>
          (d.ticker || '').toLowerCase().includes(q) ||
          (d.name || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [directory, coreTickers, search, filtersApplied, numericFiltersActive]);

  const totalFilteredCount = filteredStocks.length + filteredDirectory.length;

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, selectedSectors, selectedIndustry, sortBy, ratioFilters]);

  const paginatedStocks = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    const fromCore = filteredStocks.slice(start, Math.min(end, filteredStocks.length));
    if (fromCore.length >= pageSize || end <= filteredStocks.length) {
      return fromCore;
    }
    const dirStart = Math.max(0, start - filteredStocks.length);
    const need = pageSize - fromCore.length;
    const stubs = filteredDirectory.slice(dirStart, dirStart + need).map(toDirectoryStub);
    return [...fromCore, ...stubs];
  }, [filteredStocks, filteredDirectory, page, pageSize]);

  const totalPages = Math.ceil(totalFilteredCount / pageSize);

  const handleRowClick = (stock: Stock) => {
    openStockDetail(stock);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedSectors([]);
    setSelectedIndustry(null);
    setRatioFilters([]);
    setFiltersApplied(false);
    // Reload from cached database
    loadInitialData();
  };

  const addRatioFilter = () => {
    setRatioFilters(prev => [...prev, {
      field: 'marketCap',
      operator: 'gt',
      value: null,
      enabled: true
    }]);
  };

  const handleExportCSV = () => {
    const headers = ['Ticker', 'Name', 'Sector', 'Industry', 'Price', 'Volume', 'Mkt Cap', 'Beta', 'Div%'];
    const rows = filteredStocks.map((s) => [
      s.ticker,
      s.name,
      s.sector,
      s.industry || '',
      (s.price ?? 0).toFixed(2),
      s.volume ?? 0,
      s.marketCap ?? 0,
      (s.beta ?? 0).toFixed(2),
      ((s.dividendYield ?? 0) * 100).toFixed(2),
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

  const hasFilters = search || selectedSectors.length > 0 || selectedIndustry || ratioFilters.some(f => f.enabled && f.value !== null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-positive" />
          <div className="text-lg text-muted-foreground">Loading stocks...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-negative text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Compact Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-serif)' }}>Stock Screener</h1>
            <p className="text-xs text-dim">Browse and filter equities</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs border-secondary bg-muted hover:bg-secondary text-soft" 
              onClick={handleCopyTickers}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs border-secondary bg-muted hover:bg-secondary text-soft" 
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
          {/* Search with Symbol Dropdown */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-dim z-10" />
            {searchingSymbols && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-dim animate-spin z-10" />
            )}
            <Input
              ref={searchInputRef}
              placeholder="Search any stocks"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => search.length > 0 && symbolResults.length > 0 && setShowSymbolDropdown(true)}
              className="h-7 pl-7 pr-7 text-xs bg-card border-border text-foreground placeholder:text-dim"
            />
            {/* Symbol Search Dropdown */}
            {showSymbolDropdown && symbolResults.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-secondary rounded-lg shadow-xl z-50 max-h-[300px] overflow-y-auto"
              >
                <div className="px-2 py-1.5 text-[10px] text-dim uppercase font-semibold border-b border-border">
                  Search Results ({symbolResults.length})
                </div>
                {symbolResults.map((symbol) => (
                  <button
                    key={symbol.ticker}
                    onClick={() => handleSymbolSelect(symbol)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{symbol.ticker}</span>
                      {symbol.is_sp500 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-positive/20 text-positive font-medium">
                          S&P 500
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">{symbol.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sector Filter */}
          <Select
            value={selectedSectors.length === 1 ? selectedSectors[0] : "all"}
            onValueChange={(v) => setSelectedSectors(v && v !== "all" ? [v as Sector] : [])}
          >
            <SelectTrigger className="w-32 h-7 text-xs bg-card border-border text-foreground">
              <Filter className="h-3 w-3 mr-1 text-dim" />
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent className="bg-card border-secondary">
              <SelectItem value="all">All Sectors</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector} value={sector}>
                  {sector}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Industry Filter */}
          <Select
            value={selectedIndustry || "all"}
            onValueChange={(v) => setSelectedIndustry(v && v !== "all" ? v : null)}
          >
            <SelectTrigger className="w-36 h-7 text-xs bg-card border-border text-foreground">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent className="bg-card border-secondary max-h-60">
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-28 h-7 text-xs bg-card border-border text-foreground">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="bg-card border-secondary">
              <SelectItem value="marketCap">Mkt Cap</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="dividendYield">Dividend</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="ticker">Ticker</SelectItem>
            </SelectContent>
          </Select>

          {/* Add Filter Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-secondary bg-muted hover:bg-secondary text-soft"
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
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}

          <div className="flex-1" />

          {/* Count */}
          <span className="text-xs text-dim">
            {totalFilteredCount.toLocaleString()} stocks{filtersApplied && ' (filtered)'}
          </span>
        </div>

        {/* Ratio Filters Panel */}
        {showFilters && (
          <div className="mt-2 p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Ratio Filters</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-positive hover:text-positive"
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
                <p className="text-xs text-dim italic">No filters. Click "Add Filter" to create one.</p>
              )}
            </div>
            {/* APPLY FILTERS BUTTON - Triggers FMP company-screener call */}
            <div className="mt-3 pt-3 border-t border-border flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-secondary bg-muted hover:bg-secondary text-soft"
                onClick={clearFilters}
              >
                Reset All
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-positive hover:bg-positive text-foreground"
                onClick={applyFiltersFromFMP}
                disabled={loading || (selectedSectors.length === 0 && !selectedIndustry && ratioFilters.filter(f => f.enabled && f.value !== null).length === 0)}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply Filters'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Compact Data Table */}
      <div className="flex-1 px-4 pb-2 overflow-hidden">
        <div className="bg-card border border-border rounded-lg overflow-hidden h-full flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted border-b border-secondary">
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-dim uppercase w-6"></th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-dim uppercase">Ticker</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-dim uppercase max-w-[140px]">Company</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-dim uppercase">Sector</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-dim uppercase">Industry</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-dim uppercase">Price</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-dim uppercase">Volume</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-dim uppercase">Mkt Cap</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-dim uppercase">Beta</th>
                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-dim uppercase">Div%</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStocks.map((stock) => {
                  const isWatched = watchlist.includes(stock.ticker);
                  const isStub = stock.dataSource === 'directory';

                  return (
                    <tr
                      key={stock.ticker}
                      onClick={() => handleRowClick(stock)}
                      className="border-b border-border/30 hover:bg-muted/40 cursor-pointer transition-colors group"
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
                            isWatched ? "fill-yellow-500 text-yellow-500" : "text-dim hover:text-yellow-500"
                          )} />
                        </button>
                      </td>
                      <td className="px-2 py-1">
                        <span className="font-semibold text-foreground">{stock.ticker}</span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground max-w-[140px] truncate">
                        {stock.name}
                      </td>
                      <td className="px-2 py-1">
                        <span className="text-[10px] text-dim bg-muted px-1.5 py-0.5 rounded">
                          {stock.sector?.split(' ')[0] || '-'}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground text-[10px] max-w-[100px] truncate">
                        {stock.industry || '-'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-foreground">
                        {isStub ? '-' : formatPrice(stock.price)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-soft">
                        {isStub || !stock.volume ? '-' : formatCompact(stock.volume)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-soft">
                        {isStub || !stock.marketCap ? '-' : `$${formatCompact(stock.marketCap)}`}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-soft">
                        {isStub ? '-' : formatRatio(stock.beta, 2)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-soft">
                        {stock.dividendYield ? `${formatRatio((stock.dividendYield ?? 0) * 100)}%` : '-'}
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
            <span className="text-xs text-dim">
              {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalFilteredCount)} of {totalFilteredCount.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="h-6 w-6 p-0 border-secondary bg-muted hover:bg-secondary text-soft disabled:opacity-30"
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-6 w-6 p-0 border-secondary bg-muted hover:bg-secondary text-soft disabled:opacity-30"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-6 w-6 p-0 border-secondary bg-muted hover:bg-secondary text-soft disabled:opacity-30"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="h-6 w-6 p-0 border-secondary bg-muted hover:bg-secondary text-soft disabled:opacity-30"
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
