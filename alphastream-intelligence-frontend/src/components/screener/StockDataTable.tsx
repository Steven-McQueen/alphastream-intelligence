import { useMemo, useState, useRef, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Stock, Sector } from '@/types';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useWatchlist } from '@/contexts/WatchlistContext';

interface StockDataTableProps {
  data: Stock[];
  onRowClick?: (stock: Stock) => void;
  selectedTicker?: string | null;
}

const formatNumber = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatPercent = (value: number | undefined): string => {
  if (value === undefined || Number.isNaN(value)) return '—';
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const formatMarketCap = (value: number | undefined): string => {
  if (value === undefined || Number.isNaN(value)) return '—';
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}T`;
  if (value >= 1) return `$${value.toFixed(0)}B`;
  return `$${(value * 1000).toFixed(0)}M`;
};

export function StockDataTable({ data, onRowClick, selectedTicker }: StockDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  const columns = useMemo<ColumnDef<Stock>[]>(
    () => [
      {
        id: 'watchlist',
        header: '',
        size: 40,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWatchlist(row.original.ticker);
            }}
            className="group"
          >
            <Star
              className={cn(
                'w-4 h-4 transition-colors',
                isInWatchlist(row.original.ticker)
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'text-zinc-600 group-hover:text-zinc-400'
              )}
            />
          </button>
        ),
      },
      {
        accessorKey: 'ticker',
        header: 'Ticker',
        size: 80,
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-foreground">
            {row.original.ticker}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        size: 180,
        cell: ({ row }) => (
          <span className="text-muted-foreground truncate block max-w-[160px]">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'sector',
        header: 'Sector',
        size: 140,
        filterFn: (row, id, value: Sector[]) => {
          if (!value?.length) return true;
          return value.includes(row.getValue(id));
        },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate block max-w-[120px]">
            {row.original.sector}
          </span>
        ),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        size: 90,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            ${formatNumber(row.original.price)}
          </span>
        ),
      },
      {
        accessorKey: 'change1D',
        header: '1D %',
        size: 80,
        cell: ({ row }) => (
          <span
            className={cn(
              'font-mono',
              (row.original.change1D ?? 0) >= 0 ? 'text-positive' : 'text-negative'
            )}
          >
            {formatPercent(row.original.change1D)}
          </span>
        ),
      },
      {
        accessorKey: 'marketCap',
        header: 'Mkt Cap',
        size: 90,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {formatMarketCap(row.original.marketCap)}
          </span>
        ),
      },
      {
        accessorKey: 'peRatio',
        header: 'P/E',
        size: 80,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.peRatio === null || row.original.peRatio === undefined
              ? 'N/A'
              : formatNumber(row.original.peRatio, 2)}
          </span>
        ),
      },
      {
        accessorKey: 'eps',
        header: 'EPS',
        size: 80,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.eps === undefined
              ? 'N/A'
              : `$${formatNumber(row.original.eps, 2)}`}
          </span>
        ),
      },
      {
        accessorKey: 'roe',
        header: 'ROE',
        size: 80,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.roe === undefined
              ? 'N/A'
              : formatPercent(row.original.roe)}
          </span>
        ),
      },
      {
        accessorKey: 'netProfitMargin',
        header: 'Net Margin',
        size: 100,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.netProfitMargin === undefined
              ? 'N/A'
              : formatPercent(row.original.netProfitMargin)}
          </span>
        ),
      },
      {
        accessorKey: 'catalysts',
        header: 'Catalysts',
        size: 200,
        cell: ({ row }) => (
          <div className="flex gap-1 overflow-hidden">
            {(row.original.catalysts ?? []).slice(0, 2).map((catalyst) => (
              <Badge
                key={catalyst}
                variant="outline"
                className="text-[10px] px-1.5 py-0 whitespace-nowrap"
              >
                {catalyst}
              </Badge>
            ))}
            {(row.original.catalysts ?? []).length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{(row.original.catalysts ?? []).length - 2}
              </span>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 36,
    getScrollElement: () => tableContainerRef.current,
    overscan: 20,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <div
      ref={tableContainerRef}
      className="h-full overflow-auto scrollbar-thin"
    >
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
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  'border-b border-border/50 cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-primary/10'
                    : 'hover:bg-muted/50'
                )}
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

function ScoreCell({ value }: { value: number }) {
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-positive';
    if (score >= 40) return 'text-warning';
    return 'text-negative';
  };

  return (
    <span className={cn('font-mono font-medium', getScoreColor(value))}>
      {value}
    </span>
  );
}
