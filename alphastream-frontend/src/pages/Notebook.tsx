import { useEffect } from 'react';
import { useNotebookStore } from '@/hooks/useNotebookStore';
import { NotebookSidebar } from '@/components/notebook/NotebookSidebar';
import { NotebookHeader } from '@/components/notebook/NotebookHeader';
import { NotebookEditor } from '@/components/notebook/NotebookEditor';

export default function Notebook() {
  const store = useNotebookStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void store.saveNotebook();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  return (
    <div className="notebook-workspace flex h-[calc(100vh-8rem)] min-h-0 overflow-hidden">
      <NotebookSidebar store={store} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--nb-bg)]">
        <NotebookHeader store={store} />
        <NotebookEditor store={store} />
      </div>
    </div>
  );
}
