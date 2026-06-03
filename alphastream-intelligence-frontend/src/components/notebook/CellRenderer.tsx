import { cn } from '@/lib/utils';
import { MarkdownCell } from './MarkdownCell';
import { CodeCell } from './CodeCell';
import { CellToolbar } from './CellToolbar';
import type { Cell } from '@/types/notebook';
import type { NotebookStore } from '@/hooks/useNotebookStore';

interface CellRendererProps {
  cell: Cell;
  index: number;
  totalCells: number;
  isActive: boolean;
  store: NotebookStore;
}

export function CellRenderer({
  cell,
  index,
  totalCells,
  isActive,
  store,
}: CellRendererProps) {
  const {
    setActiveCell,
    updateCellSource,
    removeCell,
    moveCellUp,
    moveCellDown,
    toggleCellType,
    runCell,
    runningCellId,
    kernelStatus,
  } = store;

  const languageBadge = cell.type === 'markdown' ? 'markdown' : 'Python';
  const isRunning = runningCellId === cell.id;

  return (
    <div
      id={`nb-cell-${cell.id}`}
      className={cn(
        'group relative border border-[var(--nb-cell-border)] bg-[var(--nb-cell-bg)]',
        'rounded-xl overflow-hidden transition-[border-color,box-shadow] scroll-mt-4',
        isActive && 'border-[var(--nb-cell-border-active)] ring-1 ring-[var(--nb-cell-border-active)]'
      )}
      onClick={() => setActiveCell(cell.id)}
    >
      <CellToolbar
        cellType={cell.type}
        canMoveUp={index > 0}
        canMoveDown={index < totalCells - 1}
        onRun={
          cell.type === 'code' && kernelStatus !== 'busy'
            ? () => void runCell(cell.id)
            : undefined
        }
        onDelete={() => removeCell(cell.id)}
        onMoveUp={() => moveCellUp(cell.id)}
        onMoveDown={() => moveCellDown(cell.id)}
        onToggleType={() => toggleCellType(cell.id)}
      />

      {cell.type === 'markdown' ? (
        <MarkdownCell
          cell={cell}
          onSourceChange={(source) => updateCellSource(cell.id, source)}
          onFocus={() => setActiveCell(cell.id)}
        />
      ) : (
        <CodeCell
          cell={cell}
          isRunning={isRunning}
          onSourceChange={(source) => updateCellSource(cell.id, source)}
          onRun={() => void runCell(cell.id)}
          onFocus={() => setActiveCell(cell.id)}
        />
      )}

      <span
        className="pointer-events-none absolute bottom-1 right-2 text-[10px] lowercase tracking-wide"
        style={{ color: 'var(--nb-badge)' }}
      >
        {languageBadge}
      </span>
    </div>
  );
}
