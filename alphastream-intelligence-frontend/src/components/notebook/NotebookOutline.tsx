import { cn } from '@/lib/utils';
import { buildNotebookOutline } from '@/lib/notebook/outline';
import type { NotebookStore } from '@/hooks/useNotebookStore';

interface NotebookOutlineProps {
  store: NotebookStore;
}

export function NotebookOutline({ store }: NotebookOutlineProps) {
  const { activeNotebook, activeCellId, setActiveCell } = store;
  const items = activeNotebook ? buildNotebookOutline(activeNotebook.cells) : [];

  if (!activeNotebook) {
    return (
      <p className="px-3 py-2 text-xs text-[var(--nb-badge)]">Open a notebook for outline.</p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-[var(--nb-badge)]">
        Add markdown headings (<code className="text-[10px]"># Title</code>) to build an outline.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 px-2 pb-3">
      {items.map((item, idx) => (
        <li key={`${item.cellId}-${idx}`}>
          <button
            type="button"
            onClick={() => {
              setActiveCell(item.cellId);
              const el = document.getElementById(`nb-cell-${item.cellId}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={cn(
              'w-full truncate rounded-md py-1 text-left text-[12px] transition-colors',
              'hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)]',
              activeCellId === item.cellId
                ? 'text-[var(--nb-fg)] bg-[var(--nb-hover)]'
                : 'text-[var(--nb-fg-muted)]'
            )}
            style={{ paddingLeft: `${(item.level - 1) * 10 + 8}px` }}
            title={item.title}
          >
            {item.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
