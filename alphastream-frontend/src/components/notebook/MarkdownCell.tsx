import { useCallback, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALPHASTREAM_MONACO_THEME,
  defineNotebookMonacoTheme,
  notebookEditorOptions,
} from './monacoTheme';
import type { Cell } from '@/types/notebook';
import 'katex/dist/katex.min.css';

/** `$ x^2 $` → `$x^2$` so KaTeX can parse spaced delimiters */
function normalizeMathInMarkdown(source: string): string {
  return source.replace(/\$\s+([^$\n]+?)\s+\$/g, '$$$1$');
}

interface MarkdownCellProps {
  cell: Cell;
  onSourceChange: (source: string) => void;
  onFocus: () => void;
}

export function MarkdownCell({
  cell,
  onSourceChange,
  onFocus,
}: MarkdownCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(
    null
  );
  const [height, setHeight] = useState(80);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    onFocus();
  }, [onFocus]);

  const stopEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

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
        id: `render-md-${cell.id}`,
        label: 'Render markdown',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
        run: () => stopEditing(),
      });

      editor.onDidFocusEditorText(() => onFocus());
      editor.focus();
    },
    [cell.id, onFocus, stopEditing]
  );

  return (
    <div className="flex min-h-0">
      <div className="flex w-7 shrink-0 flex-col items-center bg-[var(--nb-gutter)] py-1">
        <span
          className="mt-0.5 text-[var(--nb-fg-muted)]"
          title="Markdown cell"
          aria-hidden
        >
          <FileText className="h-3 w-3" />
        </span>
      </div>

      <div className="relative min-w-0 flex-1">
        {isEditing ? (
          <div style={{ height }}>
            <Editor
              language="markdown"
              theme={ALPHASTREAM_MONACO_THEME}
              value={cell.source}
              onChange={(value) => onSourceChange(value ?? '')}
              onMount={handleMount}
              options={{
                ...notebookEditorOptions,
                wordWrap: 'on',
                lineNumbers: 'off',
              }}
            />
          </div>
        ) : (
          <div
            className={cn(
              'nb-markdown-render px-3 py-2 pr-14 pb-5 min-h-[2.25rem] cursor-text',
              'prose prose-invert prose-sm max-w-none overflow-visible'
            )}
            onDoubleClick={startEditing}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') startEditing();
            }}
          >
            {cell.source.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {normalizeMathInMarkdown(cell.source)}
              </ReactMarkdown>
            ) : (
              <p className="text-[var(--nb-badge)] text-sm m-0">
                Double-click to edit markdown
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
