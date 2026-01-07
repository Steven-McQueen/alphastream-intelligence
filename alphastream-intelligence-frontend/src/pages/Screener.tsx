import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Stock, Sector } from '@/types';
import { StockDataTable } from '@/components/screener/StockDataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Download, Copy, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useStockDetail } from '@/contexts/StockDetailContext';

type SortOption = 'ticker' | 'change1D' | 'marketCap' | 'change1Y';

export default function Screener() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<Sector[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('marketCap');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openStockDetail } = useStockDetail();

  useEffect(() => {
    fetch('http://localhost:8000/api/universe/core')
      .then((res) => {
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log('✅ Loaded', data.length, 'stocks from backend');
        setStocks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('❌ Backend error:', err);
        setError('Could not connect to backend. Make sure it is running on port 8000.');
        setLoading(false);
      });
  }, []);

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

  const sectors = useMemo(() => {
    const unique = new Set<Sector>();
    stocks.forEach((s) => unique.add(s.sector));
    return Array.from(unique).sort();
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.ticker.toLowerCase().includes(searchLower) ||
          s.name.toLowerCase().includes(searchLower)
      );
    }

    if (selectedSectors.length > 0) {
      result = result.filter((s) => selectedSectors.includes(s.sector));
    }

    result.sort((a, b) => {
      const safe = (v?: number) => (Number.isFinite(v as number) ? (v as number) : 0);
      switch (sortBy) {
        case 'ticker':
          return a.ticker.localeCompare(b.ticker);
        case 'change1D':
          return safe(b.change1D) - safe(a.change1D);
        case 'marketCap':
          return safe(b.marketCap) - safe(a.marketCap);
        case 'change1Y':
          return safe(b.change1Y) - safe(a.change1Y);
        default:
          return 0;
      }
    });

    return result;
  }, [stocks, search, selectedSectors, sortBy]);

  const handleRowClick = (stock: Stock) => {
    openStockDetail(stock);
  };

  const handleSectorToggle = (sector: Sector) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedSectors([]);
  };

  const handleExportCSV = () => {
    const headers = ['Ticker', 'Name', 'Sector', 'Price', '1D %', '1Y %', 'Market Cap'];
    const rows = filteredStocks.map((s) => [
      s.ticker,
      s.name,
      s.sector,
      (s.price ?? 0).toFixed(2),
      (s.change1D ?? 0).toFixed(2),
      (s.change1Y ?? 0).toFixed(2),
      ((s.marketCap ?? 0)).toFixed(1),
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

  const hasFilters = search || selectedSectors.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading stocks from backend...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-background/50">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ticker or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        {/* Sector Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Sectors
              {selectedSectors.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {selectedSectors.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Filter by Sector</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sectors.map((sector) => (
              <DropdownMenuCheckboxItem
                key={sector}
                checked={selectedSectors.includes(sector)}
                onCheckedChange={() => handleSectorToggle(sector)}
              >
                {sector}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="marketCap">Market Cap</SelectItem>
            <SelectItem value="change1D">1D Change</SelectItem>
            <SelectItem value="change1Y">1Y Performance</SelectItem>
            <SelectItem value="ticker">Ticker A-Z</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}

        <div className="flex-1" />

        {/* Stock Count */}
        <span className="text-xs text-muted-foreground">
          {filteredStocks.length} stocks
        </span>

        {/* Export Actions */}
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleCopyTickers}>
          <Copy className="h-3.5 w-3.5" />
          Copy Tickers
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleExportCSV}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-hidden">
        <StockDataTable
          data={filteredStocks}
          onRowClick={handleRowClick}
          selectedTicker={undefined}
        />
      </div>
    </div>
  );
}
