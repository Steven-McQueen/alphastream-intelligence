/**
 * nbformat v4-compatible types for round-trip with Jupyter / VS Code.
 * Internal `id` is stored in cell.metadata.alphastream_id for React keys.
 */

export type CellType = 'markdown' | 'code';

export type KernelStatus =
  | 'disconnected'
  | 'connecting'
  | 'idle'
  | 'busy'
  | 'restarting'
  | 'dead';

/** nbformat stream output */
export interface NbStreamOutput {
  output_type: 'stream';
  name: 'stdout' | 'stderr';
  text: string | string[];
}

/** nbformat execute_result / display_data */
export interface NbDisplayOutput {
  output_type: 'execute_result' | 'display_data';
  data: Record<string, string | string[] | undefined>;
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
}

/** nbformat error output */
export interface NbErrorOutput {
  output_type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

export type NbOutput = NbStreamOutput | NbDisplayOutput | NbErrorOutput;

export interface NbCellMetadata {
  alphastream_id?: string;
  collapsed?: boolean;
  scrolled?: boolean;
  [key: string]: unknown;
}

export interface NbCodeCell {
  cell_type: 'code';
  source: string | string[];
  metadata: NbCellMetadata;
  execution_count: number | null;
  outputs: NbOutput[];
}

export interface NbMarkdownCell {
  cell_type: 'markdown';
  source: string | string[];
  metadata: NbCellMetadata;
}

export type NbCell = NbCodeCell | NbMarkdownCell;

export interface NbNotebookMetadata {
  kernelspec?: {
    display_name: string;
    language: string;
    name: string;
  };
  language_info?: {
    name: string;
    version?: string;
  };
  [key: string]: unknown;
}

export interface NbNotebookContent {
  nbformat: number;
  nbformat_minor: number;
  metadata: NbNotebookMetadata;
  cells: NbCell[];
}

/** Editor-facing cell (normalized source string + stable id) */
export interface Cell {
  id: string;
  type: CellType;
  source: string;
  outputs: NbOutput[];
  executionCount: number | null;
  metadata: {
    collapsed: boolean;
    scrolled: boolean;
  };
}

export interface NotebookFile {
  /** Contents API path, e.g. "analysis.ipynb" */
  path: string;
  title: string;
  cells: Cell[];
  metadata: NbNotebookMetadata;
  lastModified?: string;
}

export interface NotebookListItem {
  path: string;
  name: string;
  lastModified?: string;
}

const ALPHASTREAM_ID_KEY = 'alphastream_id';

export function normalizeSource(source: string | string[]): string {
  if (Array.isArray(source)) {
    return source.join('');
  }
  return source;
}

export function getCellId(cell: NbCell): string {
  const meta = cell.metadata ?? {};
  if (typeof meta[ALPHASTREAM_ID_KEY] === 'string') {
    return meta[ALPHASTREAM_ID_KEY];
  }
  const id = crypto.randomUUID();
  cell.metadata = { ...meta, [ALPHASTREAM_ID_KEY]: id };
  return id;
}

export function fromNbCell(cell: NbCell): Cell {
  const id = getCellId(cell);
  const meta = cell.metadata ?? {};
  if (cell.cell_type === 'code') {
    return {
      id,
      type: 'code',
      source: normalizeSource(cell.source),
      outputs: cell.outputs ?? [],
      executionCount: cell.execution_count ?? null,
      metadata: {
        collapsed: Boolean(meta.collapsed),
        scrolled: Boolean(meta.scrolled),
      },
    };
  }
  return {
    id,
    type: 'markdown',
    source: normalizeSource(cell.source),
    outputs: [],
    executionCount: null,
    metadata: {
      collapsed: Boolean(meta.collapsed),
      scrolled: Boolean(meta.scrolled),
    },
  };
}

export function toNbCell(cell: Cell): NbCell {
  const metadata: NbCellMetadata = {
    [ALPHASTREAM_ID_KEY]: cell.id,
    collapsed: cell.metadata.collapsed,
    scrolled: cell.metadata.scrolled,
  };
  if (cell.type === 'code') {
    return {
      cell_type: 'code',
      source: cell.source,
      metadata,
      execution_count: cell.executionCount,
      outputs: cell.outputs,
    };
  }
  return {
    cell_type: 'markdown',
    source: cell.source,
    metadata,
  };
}

export function createEmptyNbNotebook(title = 'Untitled'): NbNotebookContent {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
      },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: { [ALPHASTREAM_ID_KEY]: crypto.randomUUID() },
        source: `# ${title}\n\nConnect to your local Jupyter server to run cells.`,
      },
    ],
  };
}

export function nbContentToNotebookFile(
  path: string,
  content: NbNotebookContent | null | undefined,
  lastModified?: string
): NotebookFile {
  const baseName = path.replace(/\.ipynb$/i, '').split('/').pop() ?? path;
  return {
    path,
    title: baseName,
    cells: (content?.cells ?? []).map(fromNbCell),
    metadata: content?.metadata ?? {},
    lastModified,
  };
}

export function notebookFileToNbContent(file: NotebookFile): NbNotebookContent {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: { name: 'python' },
      ...file.metadata,
    },
    cells: file.cells.map(toNbCell),
  };
}

export function createCell(type: CellType, source = ''): Cell {
  return {
    id: crypto.randomUUID(),
    type,
    source,
    outputs: [],
    executionCount: null,
    metadata: { collapsed: false, scrolled: false },
  };
}

export function notebookTitleFromPath(path: string): string {
  return path.replace(/\.ipynb$/i, '').split('/').pop() ?? path;
}
