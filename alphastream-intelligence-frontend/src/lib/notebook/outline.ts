import type { Cell } from '@/types/notebook';

export interface OutlineItem {
  cellId: string;
  level: number;
  title: string;
  cellIndex: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

export function buildNotebookOutline(cells: Cell[]): OutlineItem[] {
  const items: OutlineItem[] = [];

  cells.forEach((cell, cellIndex) => {
    if (cell.type !== 'markdown') return;
    const lines = cell.source.split('\n');
    for (const line of lines) {
      const match = line.match(HEADING_RE);
      if (!match) continue;
      items.push({
        cellId: cell.id,
        level: match[1].length,
        title: match[2].trim(),
        cellIndex,
      });
    }
  });

  return items;
}
