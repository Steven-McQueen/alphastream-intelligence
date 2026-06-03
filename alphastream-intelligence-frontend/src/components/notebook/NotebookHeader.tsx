import { useEffect, useRef, useState } from 'react';
import {
  Code2,
  FileText,
  Play,
  Plug,
  List,
  CircleX,
  MoreHorizontal,
  Plus,
  Save,
  Square,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { NotebookStore } from '@/hooks/useNotebookStore';
import type { KernelStatus } from '@/types/notebook';
import { JupyterConnectionDialog } from './JupyterConnectionDialog';

interface NotebookHeaderProps {
  store: NotebookStore;
}

function notebookTabFilename(title: string, path?: string): string {
  if (path) return path.split('/').pop() ?? path;
  const base = title.trim() || 'Untitled';
  const withoutExt = base.replace(/\.ipynb$/i, '');
  return `${withoutExt}.ipynb`;
}

function IpynbIcon() {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
      style={{ background: 'linear-gradient(135deg, #f37726 0%, #f9a825 100%)' }}
      aria-hidden
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
    </span>
  );
}

function ToolbarBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-[24px] items-center gap-1 rounded-md px-2 text-[12px] text-[var(--nb-fg-muted)]',
        'hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)] disabled:opacity-40 disabled:pointer-events-none transition-colors'
      )}
    >
      {children}
    </button>
  );
}

function kernelStatusLabel(status: KernelStatus): string {
  switch (status) {
    case 'disconnected':
      return 'Disconnected';
    case 'connecting':
      return 'Connecting…';
    case 'idle':
      return 'Python 3 (idle)';
    case 'busy':
      return 'Busy';
    case 'restarting':
      return 'Restarting…';
    case 'dead':
      return 'Kernel dead';
    default:
      return 'Python 3';
  }
}

export function NotebookHeader({ store }: NotebookHeaderProps) {
  const {
    activeNotebook,
    openTabs,
    activePath,
    setActiveTab,
    closeNotebook,
    addCell,
    runAll,
    clearAllOutputs,
    kernelStatus,
    saveNotebook,
    restartKernel,
    interruptKernel,
    saveError,
    renameActiveNotebook,
    deleteActiveNotebook,
  } = store;

  const [editingTab, setEditingTab] = useState(false);
  const [titleDraft, setTitleDraft] = useState(activeNotebook?.title ?? '');
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleDraft(activeNotebook?.title ?? '');
  }, [activeNotebook?.title, activeNotebook?.path]);

  useEffect(() => {
    if (editingTab && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTab]);

  const tabFilename = activeNotebook
    ? notebookTabFilename(activeNotebook.title, activeNotebook.path)
    : 'No notebook';

  const commitTitle = () => {
    const trimmed = titleDraft.trim() || 'Untitled';
    setEditingTab(false);
    void renameActiveNotebook(trimmed);
    setTitleDraft(trimmed.replace(/\.ipynb$/i, ''));
  };

  const runDisabled =
    !activeNotebook ||
    kernelStatus === 'busy' ||
    kernelStatus === 'connecting' ||
    kernelStatus === 'disconnected';

  return (
    <>
      <header className="shrink-0 border-b border-[var(--nb-cell-border)] bg-[var(--nb-chrome)]">
        <div className="flex h-10 items-end gap-1 overflow-x-auto bg-[var(--nb-tab-inactive)] px-2 scrollbar-slim">
          {openTabs.length === 0 ? (
            <div className="flex h-[34px] items-center gap-2 px-3 text-[13px] text-[var(--nb-fg-muted)]">
              <IpynbIcon />
              <span>No notebook open</span>
            </div>
          ) : (
            openTabs.map((tab) => {
              const isActive = tab.path === activePath;
              const filename = notebookTabFilename(tab.title, tab.path);
              return (
                <div
                  key={tab.path}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (!isActive) void setActiveTab(tab.path);
                  }}
                  className={cn(
                    'group flex h-[34px] max-w-[240px] shrink-0 cursor-pointer items-center gap-2 border border-b-0 px-3 text-[13px]',
                    'rounded-t-lg transition-colors',
                    isActive
                      ? 'border-[var(--nb-cell-border)] bg-[var(--nb-tab-active)] text-[var(--nb-fg)]'
                      : 'border-transparent bg-transparent text-[var(--nb-fg-muted)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)]'
                  )}
                >
                  <IpynbIcon />
                  {isActive && editingTab && activeNotebook ? (
                    <input
                      ref={inputRef}
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={commitTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTitle();
                        if (e.key === 'Escape') {
                          setTitleDraft(activeNotebook.title);
                          setEditingTab(false);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => {
                        if (isActive) setEditingTab(true);
                      }}
                      className="truncate"
                      title={
                        isActive ? 'Double-click to rename' : filename
                      }
                    >
                      {filename}
                    </span>
                  )}
                  {tab.isDirty && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-[var(--nb-fg-muted)]"
                      title="Unsaved changes"
                      aria-label="Unsaved changes"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void closeNotebook(tab.path);
                    }}
                    title="Close notebook"
                    aria-label={`Close ${filename}`}
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors',
                      'text-[var(--nb-fg-muted)] hover:bg-[var(--nb-hover)] hover:text-[var(--nb-fg)]',
                      tab.isDirty ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex h-[35px] items-center gap-0.5 bg-[var(--nb-toolbar)] px-2 flex-wrap">
          <ToolbarBtn
            label="Add code cell"
            onClick={() => addCell('code')}
            disabled={!activeNotebook}
          >
            <Plus className="h-3 w-3" />
            <Code2 className="h-3 w-3" />
            <span>Code</span>
          </ToolbarBtn>
          <ToolbarBtn
            label="Add markdown cell"
            onClick={() => addCell('markdown')}
            disabled={!activeNotebook}
          >
            <Plus className="h-3 w-3" />
            <FileText className="h-3 w-3" />
            <span>Markdown</span>
          </ToolbarBtn>

          <div className="mx-1.5 h-4 w-px bg-[var(--nb-cell-border)]" aria-hidden />

          <ToolbarBtn
            label="Run all cells"
            onClick={() => void runAll()}
            disabled={runDisabled}
          >
            <Play className="h-3 w-3" />
            <span>Run All</span>
          </ToolbarBtn>
          <ToolbarBtn
            label="Interrupt kernel"
            onClick={() => void interruptKernel()}
            disabled={kernelStatus !== 'busy'}
          >
            <Square className="h-3 w-3" />
            <span>Interrupt</span>
          </ToolbarBtn>
          <ToolbarBtn
            label="Restart kernel"
            onClick={() => void restartKernel()}
            disabled={kernelStatus === 'disconnected' || kernelStatus === 'connecting'}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Restart</span>
          </ToolbarBtn>
          <ToolbarBtn
            label="Clear all outputs"
            onClick={clearAllOutputs}
            disabled={!activeNotebook}
          >
            <CircleX className="h-3 w-3" />
            <span>Clear Outputs</span>
          </ToolbarBtn>
          <ToolbarBtn label="Save notebook (Ctrl+S)" onClick={() => void saveNotebook()}>
            <Save className="h-3 w-3" />
            <span>Save</span>
          </ToolbarBtn>
          <ToolbarBtn
            label="Delete notebook"
            onClick={() => setDeleteOpen(true)}
            disabled={!activeNotebook}
          >
            <Trash2 className="h-3 w-3" />
            <span>Delete</span>
          </ToolbarBtn>
          <ToolbarBtn
            label="Scroll to outline in sidebar"
            onClick={() => {
              document
                .querySelector('.notebook-workspace aside')
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
          >
            <List className="h-3 w-3" />
            <span>Outline</span>
          </ToolbarBtn>
          <ToolbarBtn label="More actions (coming soon)" disabled>
            <MoreHorizontal className="h-3 w-3" />
          </ToolbarBtn>

          <div className="flex-1" />

          {saveError && (
            <span
              className="text-[11px] text-[var(--nb-error)] max-w-[20rem] truncate mr-2"
              title={saveError}
            >
              {saveError}
            </span>
          )}

          <button
            type="button"
            onClick={() => setConnectionOpen(true)}
            title="Jupyter connection settings"
            className={cn(
              'inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[12px]',
              'border border-[var(--nb-cell-border)] bg-[var(--nb-kernel-pill)] transition-colors',
              kernelStatus === 'idle'
                ? 'text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)]'
                : kernelStatus === 'busy'
                  ? 'text-[var(--nb-accent)]'
                  : kernelStatus === 'disconnected'
                    ? 'text-[var(--nb-error)]'
                    : 'text-[var(--nb-fg-muted)]'
            )}
          >
            <Plug className="h-3 w-3" />
            <span>{kernelStatusLabel(kernelStatus)}</span>
          </button>
        </div>
      </header>

      <JupyterConnectionDialog
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
        onSaved={(cfg) => {
          store.applyConnectionConfig(cfg);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notebook?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{' '}
              <span className="font-medium text-foreground">{tabFilename}</span> from your
              Jupyter notebooks folder. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                setDeleting(true);
                void deleteActiveNotebook()
                  .then(() => setDeleteOpen(false))
                  .finally(() => setDeleting(false));
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
