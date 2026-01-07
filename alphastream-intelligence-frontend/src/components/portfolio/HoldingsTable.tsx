import { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { PortfolioHolding } from '@/types';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const STRATEGY_COLORS = {
  'Core Quality': 'bg-primary/20 text-primary border-primary/30',
  'Growth': 'bg-positive/20 text-positive border-positive/30',
  'Tactical': 'bg-warning/20 text-warning border-warning/30',
  'Macro Bet': 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  'Income': 'bg-chart-5/20 text-chart-5 border-chart-5/30',
};

export function HoldingsTable() {
  const { holdings } = usePortfolio();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'weight', desc: true },
  ]);

  const columns = useMemo<ColumnDef<PortfolioHolding>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: 'Ticker',
        size: 70,
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-foreground">
            {row.original.ticker}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        size: 160,
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate block max-w-[140px]">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'shares',
        header: 'Shares',
        size: 70,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            {row.original.shares.toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: 'currentPrice',
        header: 'Price',
        size: 80,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            ${row.original.currentPrice.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'marketValue',
        header: 'Value',
        size: 100,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            ${row.original.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        ),
      },
      {
        accessorKey: 'weight',
        header: 'Weight',
        size: 70,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            {row.original.weight.toFixed(1)}%
          </span>
        ),
      },
      {
        accessorKey: 'avgCostBasis',
        header: 'Avg Cost',
        size: 80,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            ${row.original.avgCostBasis.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'unrealizedPnL',
        header: 'Unrealized P&L',
        size: 110,
        cell: ({ row }) => {
          const value = row.original.unrealizedPnL;
          const percent = row.original.unrealizedPnLPercent;
          return (
            <div className={cn('font-mono', value >= 0 ? 'text-positive' : 'text-negative')}>
              <div>
                {value >= 0 ? '+' : ''}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] opacity-70">
                {percent >= 0 ? '+' : ''}{percent.toFixed(1)}%
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'dailyPnL',
        header: 'Daily P&L',
        size: 90,
        cell: ({ row }) => {
          const value = row.original.dailyPnL;
          const percent = row.original.dailyPnLPercent;
          return (
            <div className={cn('font-mono text-xs', value >= 0 ? 'text-positive' : 'text-negative')}>
              {value >= 0 ? '+' : ''}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="opacity-70 ml-1">
                ({percent >= 0 ? '+' : ''}{percent.toFixed(2)}%)
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'strategy',
        header: 'Strategy',
        size: 100,
        cell: ({ row }) => {
          const strategy = row.original.strategy;
          return (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0',
                STRATEGY_COLORS[strategy] || ''
              )}
            >
              {strategy}
            </Badge>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: holdings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <ScrollArea className="h-full">
      <table className="w-full table-dense">
        <thead className="sticky top-0 z-10 bg-background border-b border-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap select-none"
                >
                  {header.isPlaceholder ? null : (
                    <button
                      className={cn(
                        'flex items-center gap-1 hover:text-foreground transition-colors',
                        header.column.getCanSort() && 'cursor-pointer'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-muted-foreground/50">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/50 hover:bg-muted/50 transition-colors"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{ width: cell.column.getSize() }}
                  className="whitespace-nowrap"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
