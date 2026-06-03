import { useCallback, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CellOutput } from './CellOutput';
import {
  ALPHASTREAM_MONACO_THEME,
  defineNotebookMonacoTheme,
  notebookEditorOptions,
} from './monacoTheme';
import type { Cell } from '@/types/notebook';

interface CodeCellProps {
  cell: Cell;
  isRunning?: boolean;
  onSourceChange: (source: string) => void;
  onRun: () => void;
  onFocus: () => void;
}

export function CodeCell({
  cell,
  isRunning = false,
  onSourceChange,
  onRun,
  onFocus,
}: CodeCellProps) {
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(
    null
  );
  const [height, setHeight] = useState(120);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      defineNotebookMonacoTheme(monaco);
      monaco.editor.setTheme(ALPHASTREAM_MONACO_THEME);

      const updateHeight = () => {
        const contentHeight = Math.max(48, editor.getContentHeight());
        setHeight(contentHeight);
        editor.layout({ width: editor.getLayoutInfo().width, height: contentHeight });
      };

      updateHeight();
      editor.onDidContentSizeChange(updateHeight);

      editor.addAction({
        id: `run-cell-${cell.id}`,
        label: 'Run Cell',
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyCode.Enter,
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        ],
        run: () => onRun(),
      });

      editor.onDidFocusEditorText(() => onFocus());
    },
    [cell.id, onRun, onFocus]
  );

  return (
    <div className="flex flex-col">
      <div className="flex min-h-0">
        <div className="flex w-7 shrink-0 flex-col items-center bg-[var(--nb-gutter)] py-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            disabled={isRunning}
            title="Run cell (Shift+Enter)"
            aria-label="Run cell"
            className={cn(
              'flex h-[18px] w-[18px] items-center justify-center rounded-md text-[var(--nb-fg-muted)]',
              'hover:bg-[var(--nb-hover)] hover:text-[var(--nb-accent)] transition-colors',
              'disabled:opacity-40'
            )}
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
          </button>
          {cell.executionCount != null && (
            <span
              className="mt-1 text-[9px] leading-none text-[var(--nb-badge)] select-none"
              title={`Execution ${cell.executionCount}`}
            >
              [{cell.executionCount}]
            </span>
          )}
        </div>

        <div
          className="relative min-w-0 flex-1"
          style={{ height }}
          onClick={() => editorRef.current?.focus()}
        >
          <Editor
            language="python"
            theme={ALPHASTREAM_MONACO_THEME}
            value={cell.source}
            onChange={(value) => onSourceChange(value ?? '')}
            onMount={handleMount}
            options={notebookEditorOptions}
            loading={
              <div className="flex h-12 items-center px-3 text-xs text-[var(--nb-badge)]">
                Loading editor…
              </div>
            }
          />
        </div>
      </div>

      <CellOutput outputs={cell.outputs} />
    </div>
  );
}
