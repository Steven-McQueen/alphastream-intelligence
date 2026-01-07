import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Brain,
  TrendingUp,
  List,
  Briefcase,
  Sliders,
  GitCompare,
  Search,
  RefreshCw,
} from 'lucide-react';
import { getMockStocks } from '@/data/mockStocks';
import type { Stock } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAV_COMMANDS = [
  { path: '/intelligence', label: 'Intelligence', icon: Brain, description: 'AI chat interface' },
  { path: '/market', label: 'Market', icon: TrendingUp, description: 'Macro regime & sectors' },
  { path: '/screener', label: 'Screener', icon: List, description: 'Stock screener' },
  { path: '/portfolio', label: 'Portfolio', icon: Briefcase, description: 'Holdings & allocation' },
  { path: '/optimizer', label: 'Optimizer', icon: Sliders, description: 'Portfolio optimization' },
  { path: '/simulation', label: 'Simulation', icon: GitCompare, description: 'Shadow portfolio' },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);

  useEffect(() => {
    if (open) {
      setStocks(getMockStocks().slice(0, 100)); // Pre-load some stocks
    }
  }, [open]);

  // Filter stocks based on search
  const filteredStocks = search.length >= 1
    ? stocks.filter(
        (s) =>
          s.ticker.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleNavigate = (path: string) => {
    navigate(path);
    onOpenChange(false);
    setSearch('');
  };

  const handleStockSelect = (ticker: string) => {
    navigate(`/screener?stock=${ticker}`);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search stocks, commands, or navigate..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Stock Search Results */}
        {filteredStocks.length > 0 && (
          <CommandGroup heading="Stocks">
            {filteredStocks.map((stock) => (
              <CommandItem
                key={stock.ticker}
                value={`${stock.ticker} ${stock.name}`}
                onSelect={() => handleStockSelect(stock.ticker)}
              >
                <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-medium mr-2">{stock.ticker}</span>
                <span className="text-muted-foreground truncate">{stock.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {NAV_COMMANDS.map((cmd) => (
            <CommandItem
              key={cmd.path}
              value={cmd.label}
              onSelect={() => handleNavigate(cmd.path)}
            >
              <cmd.icon className="mr-2 h-4 w-4" />
              <span>{cmd.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{cmd.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Actions */}
        <CommandGroup heading="Actions">
          <CommandItem value="Refresh data">
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Refresh all data</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
