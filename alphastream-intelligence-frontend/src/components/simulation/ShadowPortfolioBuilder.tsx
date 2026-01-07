import { useState, useMemo, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Search,
  Briefcase,
  PieChart,
  AlertCircle,
  Check,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ShadowPortfolio, ShadowHolding } from '@/data/mockSimulation';

interface ShadowPortfolioBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (portfolio: ShadowPortfolio) => void;
  editingPortfolio?: ShadowPortfolio | null;
}

// Mock stock data for search
const AVAILABLE_STOCKS = [
  { ticker: 'AAPL', name: 'Apple Inc.', price: 192 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 415 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 875 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 175 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 185 },
  { ticker: 'META', name: 'Meta Platforms', price: 505 },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 248 },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', price: 410 },
  { ticker: 'JPM', name: 'JPMorgan Chase', price: 195 },
  { ticker: 'V', name: 'Visa Inc.', price: 280 },
  { ticker: 'JNJ', name: 'Johnson & Johnson', price: 162 },
  { ticker: 'PG', name: 'Procter & Gamble', price: 168 },
  { ticker: 'KO', name: 'Coca-Cola Co.', price: 62 },
  { ticker: 'PEP', name: 'PepsiCo Inc.', price: 175 },
  { ticker: 'SPY', name: 'S&P 500 ETF', price: 520 },
  { ticker: 'QQQ', name: 'Nasdaq 100 ETF', price: 485 },
  { ticker: 'VTI', name: 'Total Stock Market', price: 265 },
  { ticker: 'VXUS', name: 'Intl Stocks ETF', price: 62 },
  { ticker: 'BND', name: 'US Bonds ETF', price: 70 },
  { ticker: 'VYM', name: 'High Dividend ETF', price: 118 },
  { ticker: 'SCHD', name: 'Schwab Dividend ETF', price: 82 },
  { ticker: 'GLD', name: 'Gold ETF', price: 215 },
];

interface HoldingInput {
  ticker: string;
  name: string;
  weight: number;
  shares: number;
  price: number;
}

export function ShadowPortfolioBuilder({
  open,
  onOpenChange,
  onSave,
  editingPortfolio,
}: ShadowPortfolioBuilderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [holdings, setHoldings] = useState<HoldingInput[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<string>('');

  const isEditing = !!editingPortfolio;

  // Load existing portfolio data when editing
  useEffect(() => {
    if (editingPortfolio && open) {
      setName(editingPortfolio.name);
      setDescription(editingPortfolio.description);
      setHoldings(
        editingPortfolio.holdings.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          weight: h.weight,
          shares: h.shares,
          price: h.currentPrice,
        }))
      );
    } else if (!open) {
      // Reset form when closing
      resetForm();
    }
  }, [editingPortfolio, open]);

  // Calculate total weight
  const totalWeight = useMemo(
    () => holdings.reduce((sum, h) => sum + h.weight, 0),
    [holdings]
  );

  // Filter stocks based on search
  const filteredStocks = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return AVAILABLE_STOCKS.filter(
      (s) =>
        !holdings.some((h) => h.ticker === s.ticker) &&
        (s.ticker.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query))
    );
  }, [searchQuery, holdings]);

  // Add a holding
  const addHolding = (ticker: string) => {
    const stock = AVAILABLE_STOCKS.find((s) => s.ticker === ticker);
    if (!stock) return;

    const remainingWeight = Math.max(0, 100 - totalWeight);
    const defaultWeight = Math.min(10, remainingWeight);

    setHoldings([
      ...holdings,
      {
        ticker: stock.ticker,
        name: stock.name,
        weight: defaultWeight,
        shares: Math.round((defaultWeight * 1000) / stock.price),
        price: stock.price,
      },
    ]);
    setSearchQuery('');
    setSelectedTicker('');
  };

  // Update holding weight
  const updateWeight = (ticker: string, weight: number) => {
    setHoldings(
      holdings.map((h) =>
        h.ticker === ticker
          ? {
              ...h,
              weight,
              shares: Math.round((weight * 1000) / h.price),
            }
          : h
      )
    );
  };

  // Remove holding
  const removeHolding = (ticker: string) => {
    setHoldings(holdings.filter((h) => h.ticker !== ticker));
  };

  // Reset form
  const resetForm = () => {
    setName('');
    setDescription('');
    setHoldings([]);
    setSearchQuery('');
  };

  // Handle save
  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter a portfolio name');
      return;
    }
    if (holdings.length === 0) {
      toast.error('Please add at least one holding');
      return;
    }
    if (totalWeight !== 100) {
      toast.error('Total weight must equal 100%');
      return;
    }

    const portfolio: ShadowPortfolio = {
      id: editingPortfolio?.id || `shadow-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || `Custom shadow portfolio with ${holdings.length} holdings`,
      createdAt: editingPortfolio?.createdAt || new Date(),
      holdings: holdings.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: h.weight,
        shares: h.shares,
        avgCost: h.price,
        currentPrice: h.price,
      })),
      performance: editingPortfolio?.performance || [],
    };

    onSave(portfolio);
    resetForm();
    onOpenChange(false);
    toast.success(isEditing ? 'Shadow portfolio updated' : 'Shadow portfolio created');
  };

  // Auto-balance weights
  const autoBalance = () => {
    if (holdings.length === 0) return;
    const equalWeight = Math.floor(100 / holdings.length);
    const remainder = 100 - equalWeight * holdings.length;

    setHoldings(
      holdings.map((h, idx) => ({
        ...h,
        weight: equalWeight + (idx === 0 ? remainder : 0),
        shares: Math.round(((equalWeight + (idx === 0 ? remainder : 0)) * 1000) / h.price),
      }))
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Pencil className="w-5 h-5" />
                Edit Shadow Portfolio
              </>
            ) : (
              <>
                <Briefcase className="w-5 h-5" />
                Create Shadow Portfolio
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modify holdings and allocations for this shadow portfolio'
              : 'Build a hypothetical portfolio to compare against your actual holdings'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Portfolio Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Portfolio Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Tech-Heavy Alternative"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What strategy does this portfolio represent?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={200}
                />
              </div>
            </div>

            {/* Add Holdings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Holdings</Label>
                {holdings.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={autoBalance}
                    className="h-7 text-xs"
                  >
                    <PieChart className="w-3 h-3 mr-1" />
                    Auto-balance
                  </Button>
                )}
              </div>

              {/* Stock Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search stocks or ETFs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedTicker} onValueChange={(val) => addHolding(val)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Quick add" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {AVAILABLE_STOCKS.filter(
                      (s) => !holdings.some((h) => h.ticker === s.ticker)
                    )
                      .slice(0, 10)
                      .map((stock) => (
                        <SelectItem key={stock.ticker} value={stock.ticker}>
                          {stock.ticker}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Results */}
              {searchQuery && filteredStocks.length > 0 && (
                <div className="border border-border rounded-lg divide-y divide-border max-h-[150px] overflow-y-auto bg-card">
                  {filteredStocks.slice(0, 5).map((stock) => (
                    <button
                      key={stock.ticker}
                      className="w-full flex items-center justify-between p-2.5 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => addHolding(stock.ticker)}
                    >
                      <div>
                        <span className="font-mono font-medium text-sm">
                          {stock.ticker}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {stock.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          ${stock.price}
                        </span>
                        <Plus className="w-4 h-4 text-primary" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Holdings List */}
              <div className="space-y-3">
                {holdings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No holdings added yet</p>
                    <p className="text-xs">Search for stocks or ETFs above</p>
                  </div>
                ) : (
                  holdings.map((holding) => (
                    <div
                      key={holding.ticker}
                      className="p-3 rounded-lg border border-border bg-muted/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-medium">
                            {holding.ticker}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {holding.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {holding.weight}%
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeHolding(holding.ticker)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Slider
                          value={[holding.weight]}
                          onValueChange={(val) =>
                            updateWeight(holding.ticker, val[0])
                          }
                          min={1}
                          max={100}
                          step={1}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={holding.weight}
                          onChange={(e) =>
                            updateWeight(
                              holding.ticker,
                              Math.max(1, Math.min(100, Number(e.target.value)))
                            )
                          }
                          className="w-16 h-8 text-center font-mono text-sm"
                          min={1}
                          max={100}
                        />
                      </div>

                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>~{holding.shares} shares</span>
                        <span>${(holding.shares * holding.price).toLocaleString()} value</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Weight Progress */}
            {holdings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Allocation</span>
                  <span
                    className={`font-mono font-medium ${
                      totalWeight === 100
                        ? 'text-green-500'
                        : totalWeight > 100
                        ? 'text-red-500'
                        : 'text-amber-500'
                    }`}
                  >
                    {totalWeight}%
                  </span>
                </div>
                <Progress
                  value={Math.min(totalWeight, 100)}
                  className={`h-2 ${
                    totalWeight === 100
                      ? '[&>div]:bg-green-500'
                      : totalWeight > 100
                      ? '[&>div]:bg-red-500'
                      : '[&>div]:bg-amber-500'
                  }`}
                />
                {totalWeight !== 100 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-muted-foreground">
                      {totalWeight < 100
                        ? `Add ${100 - totalWeight}% more allocation`
                        : `Remove ${totalWeight - 100}% allocation`}
                    </span>
                  </div>
                )}
                {totalWeight === 100 && (
                  <div className="flex items-center gap-1.5 text-xs text-green-500">
                    <Check className="w-3.5 h-3.5" />
                    <span>Fully allocated</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || holdings.length === 0 || totalWeight !== 100}
            className="flex-1"
          >
            {isEditing ? 'Save Changes' : 'Create Portfolio'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
