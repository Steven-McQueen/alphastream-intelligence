import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/config/api';
import { useStockDetail } from '@/contexts/StockDetailContext';
import type { Stock } from '@/types';

interface StockItem {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  change1D: number;
  raw: Stock;
}

interface SectorGroup {
  sector: string;
  totalMarketCap: number;
  sectorChange: number;
  stocks: StockItem[];
}

interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Squarified treemap layout algorithm
function squarify(
  items: { value: number; index: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
): (TreemapRect & { index: number })[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ x, y, w, h, index: items[0].index }];
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return [];

  // Use simple slice-and-dice for small sets, squarify for larger
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const results: (TreemapRect & { index: number })[] = [];

  let remaining = [...sorted];
  let cx = x, cy = y, cw = w, ch = h;
  let remainingTotal = total;

  while (remaining.length > 0) {
    const isWide = cw >= ch;
    const side = isWide ? ch : cw;

    // Find optimal row
    let row: typeof remaining = [];
    let rowSum = 0;
    let bestAspect = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const candidateSum = rowSum + remaining[i].value;
      const rowWidth = (candidateSum / remainingTotal) * (isWide ? cw : ch);

      // Calculate worst aspect ratio in this row
      let worstAspect = 0;
      for (const item of candidate) {
        const itemHeight = (item.value / candidateSum) * side;
        const aspect = Math.max(rowWidth / itemHeight, itemHeight / rowWidth);
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect || row.length === 0) {
        row = candidate;
        rowSum = candidateSum;
        bestAspect = worstAspect;
      } else {
        break;
      }
    }

    // Layout the row
    const rowFraction = rowSum / remainingTotal;
    const rowWidth = isWide ? cw * rowFraction : cw;
    const rowHeight = isWide ? ch : ch * rowFraction;

    let offset = 0;
    for (const item of row) {
      const itemFraction = item.value / rowSum;
      const itemSize = itemFraction * (isWide ? ch : cw);

      results.push({
        x: isWide ? cx : cx + offset,
        y: isWide ? cy + offset : cy,
        w: isWide ? rowWidth : itemSize,
        h: isWide ? itemSize : rowHeight,
        index: item.index,
      });

      offset += itemSize;
    }

    // Update remaining space
    if (isWide) {
      cx += rowWidth;
      cw -= rowWidth;
    } else {
      cy += rowHeight;
      ch -= rowHeight;
    }

    remaining = remaining.slice(row.length);
    remainingTotal -= rowSum;
  }

  return results;
}

// Fully opaque heatmap colors — no background blending.
// Floor lightness kept well above black so even small-change tiles are visible.
function getHeatmapColor(change: number): string {
  const absChange = Math.abs(change);
  if (absChange < 0.01) return 'hsl(var(--muted))'; // flat → neutral
  const t = Math.min(absChange / 5, 1); // 0→1 intensity

  if (change > 0) {
    // h from CSS var, s: 40%→71%, l: 28%→45%
    const s = (40 + t * 31).toFixed(1);
    const l = (28 + t * 17).toFixed(1);
    return `hsl(var(--heatmap-positive-h), ${s}%, ${l}%)`;
  } else {
    // h from CSS var, s: 40%→84%, l: 28%→50%
    const s = (40 + t * 44).toFixed(1);
    const l = (28 + t * 22).toFixed(1);
    return `hsl(var(--heatmap-negative-h), ${s}%, ${l}%)`;
  }
}

function getTextColor(change: number): string {
  const absChange = Math.abs(change);
  if (absChange > 1) return 'hsl(var(--foreground))';
  return 'hsl(var(--muted-foreground))';
}

export function SP500Heatmap() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { openStockDetail } = useStockDetail();

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/universe/core`);
        if (res.ok) {
          const data = await res.json();
          setStocks(
            data
              .filter((s: any) => s.sector && s.marketCap > 0)
              .map((s: any) => ({
                ticker: s.ticker,
                name: s.name,
                sector: s.sector,
                marketCap: s.marketCap,
                change1D: s.change1D ?? 0,
                raw: s as Stock,
              }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch heatmap stocks:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStocks();
    const interval = setInterval(fetchStocks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const sectorGroups = useMemo((): SectorGroup[] => {
    const map = new Map<string, StockItem[]>();
    for (const s of stocks) {
      if (!map.has(s.sector)) map.set(s.sector, []);
      map.get(s.sector)!.push(s);
    }

    return Array.from(map.entries())
      .map(([sector, sectorStocks]) => {
        const totalMarketCap = sectorStocks.reduce((sum, s) => sum + s.marketCap, 0);
        const weightedChange = sectorStocks.reduce(
          (sum, s) => sum + s.change1D * s.marketCap, 0
        ) / totalMarketCap;
        return {
          sector,
          totalMarketCap,
          sectorChange: weightedChange,
          stocks: sectorStocks.sort((a, b) => b.marketCap - a.marketCap),
        };
      })
      .sort((a, b) => b.totalMarketCap - a.totalMarketCap);
  }, [stocks]);

  if (isLoading) {
    return (
      <Card className="bg-sidebar-accent border-border h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-widget-heading)' }}>
            S&P 500 Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] bg-muted/30 rounded-lg animate-[pf-shimmer_2s_ease-in-out_infinite]" />
        </CardContent>
      </Card>
    );
  }

  const CONTAINER_W = 1000;
  const CONTAINER_H = 900;
  const SECTOR_HEADER_H = 18;
  const SECTOR_PAD = 2;

  const sectorRects = squarify(
    sectorGroups.map((g, i) => ({ value: g.totalMarketCap, index: i })),
    0, 0, CONTAINER_W, CONTAINER_H,
  );

  return (
    <Card className="bg-sidebar-accent border-border h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-widget-heading)' }}>
          S&P 500 Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
        <div className="relative w-full flex-1 min-h-0 overflow-hidden rounded-lg">

          <svg
            viewBox={`0 0 ${CONTAINER_W} ${CONTAINER_H}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {sectorRects.map((sr) => {
              const group = sectorGroups[sr.index];
              const innerX = sr.x + SECTOR_PAD;
              const innerY = sr.y + SECTOR_HEADER_H;
              const innerW = sr.w - SECTOR_PAD * 2;
              const innerH = sr.h - SECTOR_HEADER_H - SECTOR_PAD;

              if (innerW < 5 || innerH < 5) return null;

              // Compute stock rects within this sector
              const stockRects = squarify(
                group.stocks.map((s, i) => ({ value: s.marketCap, index: i })),
                innerX, innerY, innerW, innerH,
              );

              const sectorIsPositive = group.sectorChange >= 0;

              return (
                <g key={group.sector}>
                  {/* Sector background */}
                  <rect
                    x={sr.x}
                    y={sr.y}
                    width={sr.w}
                    height={sr.h}
                    fill="none"
                  />

                  {/* Sector header label */}
                  {sr.w > 60 && (
                    <text
                      x={sr.x + 4}
                      y={sr.y + 13}
                      fontSize={sr.w > 150 ? 11 : 9}
                      fill="hsl(var(--muted-foreground))"
                      fontFamily="var(--font-widget-heading)"
                      fontWeight={600}
                    >
                      {group.sector}
                      <tspan
                        fill={sectorIsPositive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                        fontSize={sr.w > 150 ? 10 : 8}
                      >
                        {' '}{sectorIsPositive ? '+' : ''}{group.sectorChange.toFixed(2)}%
                      </tspan>
                    </text>
                  )}

                  {/* Stock tiles */}
                  {stockRects.map((rect) => {
                    const stock = group.stocks[rect.index];
                    const cellW = rect.w - 1;
                    const cellH = rect.h - 1;
                    if (cellW < 3 || cellH < 3) return null;

                    const showTicker = cellW > 28 && cellH > 18;
                    const showChange = cellW > 35 && cellH > 30;
                    const fontSize = cellW > 80 && cellH > 50 ? 13 : cellW > 50 ? 11 : 9;
                    const changeFontSize = fontSize - 2;

                    return (
                      <g
                        key={stock.ticker}
                        className="cursor-pointer"
                        onClick={() => openStockDetail(stock.raw)}
                      >
                        <rect
                          x={rect.x + 0.5}
                          y={rect.y + 0.5}
                          width={cellW}
                          height={cellH}
                          rx={2}
                          fill={getHeatmapColor(stock.change1D)}
                        />
                        <title>
                          {stock.ticker} - {stock.name}{'\n'}
                          {stock.change1D >= 0 ? '+' : ''}{stock.change1D.toFixed(2)}%{'\n'}
                          MCap: ${(stock.marketCap / 1e9).toFixed(0)}B
                        </title>
                        {showTicker && (
                          <text
                            x={rect.x + cellW / 2}
                            y={rect.y + (showChange ? cellH / 2 - 2 : cellH / 2 + 3)}
                            textAnchor="middle"
                            fontSize={fontSize}
                            fontWeight={700}
                            fill={getTextColor(stock.change1D)}
                            fontFamily="var(--font-widget-heading)"
                          >
                            {stock.ticker}
                          </text>
                        )}
                        {showChange && (
                          <text
                            x={rect.x + cellW / 2}
                            y={rect.y + cellH / 2 + changeFontSize + 2}
                            textAnchor="middle"
                            fontSize={changeFontSize}
                            fontWeight={500}
                            fill={getTextColor(stock.change1D)}
                            fontFamily="var(--font-widget-heading)"
                          >
                            {stock.change1D >= 0 ? '+' : ''}{stock.change1D.toFixed(2)}%
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
