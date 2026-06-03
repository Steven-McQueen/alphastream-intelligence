import {
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeftRight,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellType } from '@/types/notebook';

interface CellToolbarProps {
  cellType: CellType;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRun?: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleType: () => void;
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-[22px] w-[22px] items-center justify-center rounded-md text-[var(--nb-fg-muted)]',
        'hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)] disabled:opacity-30 disabled:pointer-events-none transition-colors',
        className
      )}
    >
      {children}
    </button>
  );
}

export function CellToolbar({
  cellType,
  canMoveUp,
  canMoveDown,
  onRun,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleType,
}: CellToolbarProps) {
  return (
    <div
      className={cn(
        'absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-lg p-0.5',
        'border border-[var(--nb-cell-border)] bg-[var(--nb-toolbar-bg)] shadow-sm',
        'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {onRun && (
        <IconBtn label="Run cell" onClick={onRun}>
          <Play className="h-3.5 w-3.5" />
        </IconBtn>
      )}
      {cellType === 'markdown' && (
        <IconBtn label="Stop editing (blur)" onClick={() => {}} disabled>
          <Check className="h-3.5 w-3.5" />
        </IconBtn>
      )}
      <IconBtn label="Move up" onClick={onMoveUp} disabled={!canMoveUp}>
        <ChevronUp className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Move down" onClick={onMoveDown} disabled={!canMoveDown}>
        <ChevronDown className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Change cell type" onClick={onToggleType}>
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="More actions (coming soon)" disabled>
        <MoreHorizontal className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Delete cell" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </IconBtn>
    </div>
  );
}
