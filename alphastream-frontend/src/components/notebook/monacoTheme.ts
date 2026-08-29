import type { editor } from 'monaco-editor';

/** VS Code–like dark theme aligned with notebook CSS tokens */
export const ALPHASTREAM_MONACO_THEME = 'alphastream-nb';

export function defineNotebookMonacoTheme(monaco: typeof import('monaco-editor')): void {
  monaco.editor.defineTheme(ALPHASTREAM_MONACO_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a9955' },
      { token: 'keyword', foreground: 'c586c0' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'type', foreground: '4ec9b0' },
      { token: 'function', foreground: 'dcdcaa' },
    ],
    colors: {
      'editor.background': '#00000000',
      'editor.foreground': '#e0e0e0',
      'editor.lineHighlightBackground': '#ffffff08',
      'editorGutter.background': '#00000000',
      'editorLineNumber.foreground': '#5a5a5a',
      'editorCursor.foreground': '#e0e0e0',
    },
  });
}

export const notebookEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'on',
  fontSize: 13,
  lineHeight: 20,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  wordWrap: 'on',
  automaticLayout: true,
  padding: { top: 8, bottom: 20 },
  renderLineHighlight: 'line',
  scrollbar: { vertical: 'hidden', horizontal: 'auto', handleMouseWheel: false },
  overviewRulerLanes: 0,
  folding: false,
  glyphMargin: false,
};
