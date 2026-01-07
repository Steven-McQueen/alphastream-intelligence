import { useState, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { getStockByTicker } from '@/data/mockStocks';
import type { Stock, Sector, PortfolioHolding, StrategyTag } from '@/types';
import { HoldingsDataTable } from '@/components/holdings/HoldingsDataTable';
import { HoldingsNewsFeed } from '@/components/holdings/HoldingsNewsFeed';
import { StockDetailSheet } from '@/components/screener/StockDetailSheet';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Send, Newspaper } from 'lucide-react';
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
import { Search, Filter, Download, Copy, X, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

type SortOption = 'weight' | 'unrealizedPnL' | 'dailyPnL' | 'marketValue' | 'ticker';

const STRATEGIES: StrategyTag[] = ['Core Quality', 'Tactical', 'Macro Bet', 'Income', 'Growth'];

export default function Holdings() {
  const { holdings } = usePortfolio();
  const [search, setSearch] = useState('');
  const [selectedStrategies, setSelectedStrategies] = useState<StrategyTag[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('weight');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Enhance holdings with full stock data
  const enhancedHoldings = useMemo(() => {
    return holdings.map((holding) => {
      const stock = getStockByTicker(holding.ticker);
      return {
        ...holding,
        stock,
      };
    }).filter((h) => h.stock); // Only include holdings where stock exists
  }, [holdings]);

  // Filter and sort holdings
  const filteredHoldings = useMemo(() => {
    let result = [...enhancedHoldings];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (h) =>
          h.ticker.toLowerCase().includes(searchLower) ||
          h.name.toLowerCase().includes(searchLower)
      );
    }

    // Strategy filter
    if (selectedStrategies.length > 0) {
      result = result.filter((h) => selectedStrategies.includes(h.strategy));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'ticker':
          return a.ticker.localeCompare(b.ticker);
        case 'weight':
          return b.weight - a.weight;
        case 'unrealizedPnL':
          return b.unrealizedPnL - a.unrealizedPnL;
        case 'dailyPnL':
          return b.dailyPnL - a.dailyPnL;
        case 'marketValue':
          return b.marketValue - a.marketValue;
        default:
          return 0;
      }
    });

    return result;
  }, [enhancedHoldings, search, selectedStrategies, sortBy]);

  const handleRowClick = (holding: PortfolioHolding & { stock?: Stock }) => {
    if (holding.stock) {
      setSelectedStock(holding.stock);
      setSheetOpen(true);
    }
  };

  const handleStrategyToggle = (strategy: StrategyTag) => {
    setSelectedStrategies((prev) =>
      prev.includes(strategy)
        ? prev.filter((s) => s !== strategy)
        : [...prev, strategy]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedStrategies([]);
  };

  const handleExportCSV = () => {
    const headers = ['Ticker', 'Name', 'Shares', 'Price', 'Value', 'Weight', 'Cost Basis', 'P&L', 'P&L %', 'Strategy'];
    const rows = filteredHoldings.map((h) => [
      h.ticker,
      h.name,
      h.shares,
      h.currentPrice.toFixed(2),
      h.marketValue.toFixed(2),
      h.weight.toFixed(2),
      h.avgCostBasis.toFixed(2),
      h.unrealizedPnL.toFixed(2),
      h.unrealizedPnLPercent.toFixed(2),
      h.strategy,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holdings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exported',
      description: `${filteredHoldings.length} holdings exported to CSV`,
    });
  };

  const handleCopyTickers = () => {
    const tickers = filteredHoldings.map((h) => h.ticker).join(', ');
    navigator.clipboard.writeText(tickers);
    toast({
      title: 'Copied',
      description: `${filteredHoldings.length} tickers copied to clipboard`,
    });
  };

  const hasFilters = search || selectedStrategies.length > 0;

  // Get tickers for news feed
  const portfolioTickers = useMemo(() => holdings.map((h) => h.ticker), [holdings]);

  const handleChatSubmit = () => {
    if (chatInput.trim()) {
      toast({
        title: 'Message sent',
        description: 'Your question has been submitted.',
      });
      setChatInput('');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-background/50 sticky top-0 z-10">
        {/* Back button */}
        <Link to="/portfolio">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Portfolio
          </Button>
        </Link>

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

        {/* Strategy Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Strategy
              {selectedStrategies.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {selectedStrategies.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Filter by Strategy</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STRATEGIES.map((strategy) => (
              <DropdownMenuCheckboxItem
                key={strategy}
                checked={selectedStrategies.includes(strategy)}
                onCheckedChange={() => handleStrategyToggle(strategy)}
              >
                {strategy}
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
            <SelectItem value="weight">Weight</SelectItem>
            <SelectItem value="marketValue">Market Value</SelectItem>
            <SelectItem value="unrealizedPnL">Total P&L</SelectItem>
            <SelectItem value="dailyPnL">Daily P&L</SelectItem>
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

        {/* Holdings Count */}
        <span className="text-xs text-muted-foreground">
          {filteredHoldings.length} holdings
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

      {/* Data Table - Takes most of the viewport height */}
      <div className="min-h-[calc(100vh-200px)]">
        <HoldingsDataTable
          data={filteredHoldings}
          onRowClick={handleRowClick}
          selectedTicker={selectedStock?.ticker}
        />
      </div>

      {/* News Widget - Appears when scrolling down */}
      <Card className="mx-3 mt-6 mb-3 border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            Portfolio News
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-80 overflow-auto">
          <HoldingsNewsFeed tickers={portfolioTickers} />
        </CardContent>
      </Card>

      {/* Chat Input */}
      <div className="p-3 border-t border-border bg-background/50 sticky bottom-0">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask about your holdings..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
              }
            }}
          />
          <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleChatSubmit}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stock Detail Sheet */}
      <StockDetailSheet
        stock={selectedStock}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
