import { useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NotebookOutline } from './NotebookOutline';
import type { NotebookStore } from '@/hooks/useNotebookStore';

interface NotebookSidebarProps {
  store: NotebookStore;
}

export function NotebookSidebar({ store }: NotebookSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const {
    notebookList,
    activeNotebook,
    openTabs,
    openNotebookByPath,
    createNotebook,
    refreshNotebookList,
    importNotebookFromFile,
    deleteNotebookByPath,
    listLoading,
    connectionStatus,
  } = store;

  const openPaths = new Set(openTabs.map((t) => t.path));

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNotebookByPath(deleteTarget.path);
      setDeleteTarget(null);
    } catch {
      // error shown via store.saveError
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <aside className="flex w-[15.5rem] shrink-0 flex-col bg-[var(--nb-chrome)] min-h-0">
        <div className="px-2 pt-3 pb-1 flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void createNotebook()}
            aria-label="New notebook"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-[var(--nb-fg-muted)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)]"
          >
            <Plus className="h-4 w-4" />
            New notebook
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-[var(--nb-fg-muted)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)]"
          >
            <Upload className="h-4 w-4" />
            Open from computer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ipynb"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importNotebookFromFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => void refreshNotebookList()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors text-[var(--nb-badge)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg-muted)]"
          >
            <RefreshCw className={cn('h-3 w-3', listLoading && 'animate-spin')} />
            Refresh list
          </button>
        </div>

        <div className="px-3 pt-2 pb-1.5 shrink-0">
          <p className="text-[0.65rem] uppercase tracking-[0.1em] text-[var(--nb-badge)]">
            Notebooks
          </p>
          {connectionStatus === 'disconnected' && (
            <p className="text-[0.65rem] text-[var(--nb-error)] mt-1">
              Not connected — open kernel settings
            </p>
          )}
        </div>

        <nav className="max-h-[28vh] shrink-0 overflow-y-auto scrollbar-slim px-2 space-y-0.5">
          {listLoading && notebookList.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[var(--nb-badge)]">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : notebookList.length === 0 ? (
            <p className="px-2 py-4 text-xs text-[var(--nb-badge)]">
              No notebooks found. Start Jupyter and create one, or open a file from your computer.
            </p>
          ) : (
            notebookList.map((item) => {
              const isActive = item.path === activeNotebook?.path;
              const isOpen = openPaths.has(item.path);
              return (
                <div
                  key={item.path}
                  className={cn(
                    'group flex items-center gap-0.5 rounded-lg transition-colors',
                    isActive ? 'bg-[var(--nb-hover)]' : 'hover:bg-[var(--nb-hover)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void openNotebookByPath(item.path)}
                    className={cn(
                      'min-w-0 flex-1 px-3 py-2 text-left',
                      isActive || isOpen ? 'text-[var(--nb-fg)]' : 'text-[var(--nb-fg-muted)]'
                    )}
                  >
                    <p className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium">
                      {isOpen && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nb-accent)]"
                          title="Open"
                          aria-hidden
                        />
                      )}
                      <span className="truncate">{item.name}</span>
                    </p>
                    {item.lastModified && (
                      <p className="text-[0.65rem] text-[var(--nb-badge)] truncate">
                        {new Date(item.lastModified).toLocaleString()}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ path: item.path, name: item.name });
                    }}
                    title={`Delete ${item.name}`}
                    aria-label={`Delete ${item.name}`}
                    className={cn(
                      'mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                      'text-[var(--nb-fg-muted)] opacity-0 transition-opacity',
                      'hover:bg-[var(--nb-cell-border)] hover:text-[var(--nb-error)]',
                      'group-hover:opacity-100 focus:opacity-100'
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </nav>

        <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-[var(--nb-cell-border)]">
          <div className="px-3 pt-2 pb-1 shrink-0">
            <p className="text-[0.65rem] uppercase tracking-[0.1em] text-[var(--nb-badge)]">
              Outline
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim">
            <NotebookOutline store={store} />
          </div>
        </div>
      </aside>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notebook?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{' '}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> from
              your Jupyter notebooks folder. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
