import { Plus, Code2, FileText } from 'lucide-react';
import { CellRenderer } from './CellRenderer';
import type { NotebookStore } from '@/hooks/useNotebookStore';

interface NotebookEditorProps {
  store: NotebookStore;
}

function AddCellDivider({
  onAddMarkdown,
  onAddCode,
}: {
  onAddMarkdown: () => void;
  onAddCode: () => void;
}) {
  return (
    <div className="group/divider relative flex h-5 items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--nb-cell-border)] opacity-0 transition-opacity group-hover/divider:opacity-100" />
      <div className="relative z-10 flex gap-1 opacity-0 transition-opacity group-hover/divider:opacity-100">
        <button
          type="button"
          onClick={onAddCode}
          className="inline-flex h-5 items-center gap-1 rounded-md bg-[var(--nb-cell-bg)] px-2 text-[11px] text-[var(--nb-fg-muted)] border border-[var(--nb-cell-border)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)] transition-colors"
        >
          <Plus className="h-2.5 w-2.5" />
          <Code2 className="h-2.5 w-2.5" />
          Code
        </button>
        <button
          type="button"
          onClick={onAddMarkdown}
          className="inline-flex h-5 items-center gap-1 rounded-md bg-[var(--nb-cell-bg)] px-2 text-[11px] text-[var(--nb-fg-muted)] border border-[var(--nb-cell-border)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)] transition-colors"
        >
          <Plus className="h-2.5 w-2.5" />
          <FileText className="h-2.5 w-2.5" />
          Markdown
        </button>
      </div>
    </div>
  );
}

export function NotebookEditor({ store }: NotebookEditorProps) {
  const { activeNotebook, activeCellId, addCell } = store;

  if (!activeNotebook) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--nb-badge)] text-sm px-6 text-center">
        <p>Select a notebook from the sidebar or create a new one.</p>
        <p className="text-xs max-w-md">
          Connect to your local Jupyter server via the kernel button in the toolbar
          (start it with <code className="text-[var(--nb-fg-muted)]">alphastream-notebooks/start-notebook-server</code>).
        </p>
      </div>
    );
  }

  const cells = activeNotebook.cells;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-slim">
      <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-1.5 px-4 py-4 pb-24">
        {cells.length === 0 ? (
          <div className="border border-dashed border-[var(--nb-cell-border)] py-16 text-center rounded-xl">
            <p className="text-sm text-[var(--nb-badge)] mb-4">This notebook is empty.</p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => addCell('markdown')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] text-[var(--nb-fg-muted)] border border-[var(--nb-cell-border)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)] transition-colors"
              >
                <FileText className="h-3 w-3" />
                Markdown
              </button>
              <button
                type="button"
                onClick={() => addCell('code')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] text-[var(--nb-fg-muted)] border border-[var(--nb-cell-border)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)] transition-colors"
              >
                <Code2 className="h-3 w-3" />
                Code
              </button>
            </div>
          </div>
        ) : (
          cells.map((cell, index) => (
            <div key={cell.id}>
              <CellRenderer
                cell={cell}
                index={index}
                totalCells={cells.length}
                isActive={activeCellId === cell.id}
                store={store}
              />
              <AddCellDivider
                onAddMarkdown={() => addCell('markdown', index)}
                onAddCode={() => addCell('code', index)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
