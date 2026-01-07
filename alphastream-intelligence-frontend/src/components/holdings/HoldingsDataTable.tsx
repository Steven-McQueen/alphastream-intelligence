import { useMemo, useRef, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PortfolioHolding, Stock } from '@/types';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type EnhancedHolding = PortfolioHolding & { stock?: Stock };

type TimePeriod = '1D' | '3D' | '5D' | '7D' | '1M' | '3M' | '1Y';

interface HoldingsDataTableProps {
  data: EnhancedHolding[];
  onRowClick?: (holding: EnhancedHolding) => void;
  selectedTicker?: string;
}

const formatNumber = (value: number, decimals = 2) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

const formatPercent = (value: number) => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatMarketCap = (value: number) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}T`;
  if (value >= 1) return `$${value.toFixed(0)}B`;
  return `$${(value * 1000).toFixed(0)}M`;
};

const STRATEGY_COLORS: Record<string, string> = {
  'Core Quality': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Tactical': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Macro Bet': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Income': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Growth': 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

function ScoreCell({ value }: { value: number }) {
  const getColor = (score: number) => {
    if (score >= 70) return 'text-positive';
    if (score >= 40) return 'text-warning';
    return 'text-negative';
  };
  return <span className={cn('font-mono text-xs', getColor(value))}>{value}</span>;
}

// Mock function to get return based on period (in real app, this would use actual historical data)
const getReturnForPeriod = (holding: EnhancedHolding, period: TimePeriod): number => {
  // Simulated returns based on daily return, scaled for demo purposes
  const baseReturn = holding.dailyPnLPercent;
  const multipliers: Record<TimePeriod, number> = {
    '1D': 1,
    '3D': 2.1,
    '5D': 3.2,
    '7D': 4.5,
    '1M': 8,
    '3M': 15,
    '1Y': 35,
  };
  return baseReturn * multipliers[period] + (Math.random() - 0.5) * 2;
};

const TIME_PERIODS: TimePeriod[] = ['1D', '3D', '5D', '7D', '1M', '3M', '1Y'];

export function HoldingsDataTable({ data, onRowClick, selectedTicker }: HoldingsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'weight', desc: true }]);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1D');
  const parentRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<EnhancedHolding>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Ticker
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium text-foreground">{row.original.ticker}</span>
        ),
        size: 70,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate max-w-[150px] block">
            {row.original.name}
          </span>
        ),
        size: 150,
      },
      {
        accessorKey: 'shares',
        header: 'Shares',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{formatNumber(row.original.shares, 0)}</span>
        ),
        size: 60,
      },
      {
        accessorKey: 'currentPrice',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Price
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">${formatNumber(row.original.currentPrice)}</span>
        ),
        size: 80,
      },
      {
        id: 'periodReturn',
        header: ({ column }) => (
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 hover:text-foreground"
              onClick={() => column.toggleSorting()}
            >
              Return
              {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="h-3 w-3" />
              ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <ArrowUpDown className="h-3 w-3 opacity-50" />
              )}
            </button>
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <SelectTrigger className="h-6 w-16 text-[10px] px-2 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {TIME_PERIODS.map((period) => (
                  <SelectItem key={period} value={period} className="text-xs">
                    {period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
        accessorFn: (row) => getReturnForPeriod(row, timePeriod),
        cell: ({ row }) => {
          const value = getReturnForPeriod(row.original, timePeriod);
          return (
            <span
              className={cn('font-mono text-xs flex items-center gap-0.5', value >= 0 ? 'text-positive' : 'text-negative')}
            >
              {value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(value)}
            </span>
          );
        },
        size: 140,
      },
      {
        accessorKey: 'marketValue',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Value
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{formatCurrency(row.original.marketValue)}</span>
        ),
        size: 90,
      },
      {
        accessorKey: 'weight',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            Weight
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.weight.toFixed(1)}%</span>
        ),
        size: 70,
      },
      {
        accessorKey: 'unrealizedPnL',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting()}
          >
            P&L
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const value = row.original.unrealizedPnL;
          const percent = row.original.unrealizedPnLPercent;
          return (
            <div className={cn('font-mono text-xs', value >= 0 ? 'text-positive' : 'text-negative')}>
              <div>{value >= 0 ? '+' : ''}{formatCurrency(value)}</div>
              <div className="text-[10px] opacity-70">{formatPercent(percent)}</div>
            </div>
          );
        },
        size: 100,
      },
      {
        id: 'marketCap',
        header: 'Mkt Cap',
        cell: ({ row }) => {
          const stock = row.original.stock;
          if (!stock) return <span className="text-muted-foreground">—</span>;
          return <span className="font-mono text-xs">{formatMarketCap(stock.marketCap)}</span>;
        },
        size: 80,
      },
      {
        id: 'qualityScore',
        header: 'Quality',
        cell: ({ row }) => {
          const stock = row.original.stock;
          if (!stock) return <span className="text-muted-foreground">—</span>;
          return <ScoreCell value={stock.qualityScore} />;
        },
        size: 60,
      },
      {
        id: 'momentumScore',
        header: 'Mom',
        cell: ({ row }) => {
          const stock = row.original.stock;
          if (!stock) return <span className="text-muted-foreground">—</span>;
          return <ScoreCell value={stock.momentumScore} />;
        },
        size: 55,
      },
      {
        id: 'valueScore',
        header: 'Value',
        cell: ({ row }) => {
          const stock = row.original.stock;
          if (!stock) return <span className="text-muted-foreground">—</span>;
          return <ScoreCell value={stock.valueScore} />;
        },
        size: 55,
      },
      {
        accessorKey: 'strategy',
        header: 'Strategy',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn('text-[10px] font-normal whitespace-nowrap', STRATEGY_COLORS[row.original.strategy])}
          >
            {row.original.strategy}
          </Badge>
        ),
        size: 100,
      },
    ],
    [timePeriod]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            const isSelected = row.original.ticker === selectedTicker;
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors',
                  isSelected && 'bg-muted'
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-2 py-2 whitespace-nowrap"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
