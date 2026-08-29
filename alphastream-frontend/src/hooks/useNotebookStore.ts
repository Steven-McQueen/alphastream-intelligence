import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  createCell,
  type Cell,
  type KernelStatus,
  type NotebookFile,
  type NotebookListItem,
  notebookTitleFromPath,
} from '@/types/notebook';
import { getConnectionConfig, setConnectionConfig, testConnection } from '@/lib/jupyter/connection';
import {
  loadConnectionConfig,
  saveConnectionConfig,
  type JupyterConnectionConfig,
} from '@/lib/jupyter/connectionConfig';
import {
  createNotebook as createNotebookFile,
  deleteNotebook as deleteNotebookFile,
  listNotebooks,
  openNotebook,
  renameNotebook as renameNotebookFile,
  saveNotebook as saveNotebookFile,
  uploadNotebook as uploadNotebookFile,
} from '@/lib/jupyter/contents';
import { parseIpynbFile, readFileAsText } from '@/lib/notebook/importLocal';
import {
  connectNotebookSession,
  executeCode,
  interruptKernel,
  restartKernel,
  shutdownSession,
  subscribeKernelStatus,
  type JupyterKernelStatus,
} from '@/lib/jupyter/session';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

interface OpenTab {
  file: NotebookFile;
  activeCellId: string | null;
  isDirty: boolean;
  runningCellId: string | null;
}

export interface OpenTabInfo {
  path: string;
  title: string;
  isDirty: boolean;
}

interface NotebookState {
  notebookList: NotebookListItem[];
  openTabs: OpenTab[];
  activePath: string | null;
  kernelStatus: KernelStatus;
  connectionStatus: 'unknown' | 'connected' | 'disconnected';
  listLoading: boolean;
  saveError: string | null;
}

type NotebookAction =
  | { type: 'SET_NOTEBOOK_LIST'; list: NotebookListItem[]; loading?: boolean }
  | { type: 'OPEN_TAB'; notebook: NotebookFile }
  | { type: 'CLOSE_TAB'; path: string }
  | { type: 'SET_ACTIVE_TAB'; path: string }
  | { type: 'REPLACE_TAB_FILE'; path: string; file: NotebookFile; keepDirty?: boolean }
  | { type: 'SET_ACTIVE_CELL'; cellId: string | null }
  | { type: 'SET_DIRTY'; path: string; dirty: boolean }
  | { type: 'SET_KERNEL_STATUS'; status: KernelStatus }
  | { type: 'SET_CONNECTION_STATUS'; status: 'unknown' | 'connected' | 'disconnected' }
  | { type: 'SET_RUNNING_CELL'; cellId: string | null }
  | { type: 'SET_SAVE_ERROR'; error: string | null }
  | { type: 'UPDATE_TITLE'; title: string }
  | { type: 'ADD_CELL'; cellType: 'markdown' | 'code'; afterIndex?: number }
  | { type: 'REMOVE_CELL'; cellId: string }
  | { type: 'UPDATE_CELL_SOURCE'; cellId: string; source: string }
  | { type: 'MOVE_CELL'; cellId: string; direction: 'up' | 'down' }
  | { type: 'TOGGLE_CELL_TYPE'; cellId: string }
  | {
      type: 'SET_CELL_OUTPUT';
      cellId: string;
      outputs: Cell['outputs'];
      executionCount?: number | null;
      markDirty?: boolean;
    }
  | { type: 'CLEAR_ALL_OUTPUTS' };

function mapJupyterStatus(status: JupyterKernelStatus): KernelStatus {
  return status;
}

function getActiveTab(state: NotebookState): OpenTab | null {
  if (!state.activePath) return null;
  return state.openTabs.find((t) => t.file.path === state.activePath) ?? null;
}

function updateTabByPath(
  state: NotebookState,
  path: string,
  fn: (tab: OpenTab) => OpenTab
): NotebookState {
  return {
    ...state,
    openTabs: state.openTabs.map((t) => (t.file.path === path ? fn(t) : t)),
  };
}

/** Edit active tab's file, marking it dirty. */
function patchActiveFile(
  state: NotebookState,
  patch: (nb: NotebookFile) => NotebookFile
): NotebookState {
  if (!state.activePath) return state;
  return updateTabByPath(state, state.activePath, (tab) => ({
    ...tab,
    isDirty: true,
    file: patch(tab.file),
  }));
}

function reducer(state: NotebookState, action: NotebookAction): NotebookState {
  switch (action.type) {
    case 'SET_NOTEBOOK_LIST':
      return {
        ...state,
        notebookList: action.list,
        listLoading: action.loading ?? false,
      };

    case 'OPEN_TAB': {
      const exists = state.openTabs.some((t) => t.file.path === action.notebook.path);
      const openTabs = exists
        ? state.openTabs.map((t) =>
            t.file.path === action.notebook.path
              ? { ...t, file: action.notebook, isDirty: false }
              : t
          )
        : [
            ...state.openTabs,
            {
              file: action.notebook,
              activeCellId: action.notebook.cells[0]?.id ?? null,
              isDirty: false,
              runningCellId: null,
            },
          ];
      return { ...state, openTabs, activePath: action.notebook.path };
    }

    case 'CLOSE_TAB': {
      const idx = state.openTabs.findIndex((t) => t.file.path === action.path);
      if (idx < 0) return state;
      const openTabs = state.openTabs.filter((t) => t.file.path !== action.path);
      let activePath = state.activePath;
      if (state.activePath === action.path) {
        const neighbor = openTabs[idx] ?? openTabs[idx - 1] ?? null;
        activePath = neighbor?.file.path ?? null;
      }
      return { ...state, openTabs, activePath };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activePath: action.path };

    case 'REPLACE_TAB_FILE': {
      const next = updateTabByPath(state, action.path, (tab) => ({
        ...tab,
        file: action.file,
        isDirty: action.keepDirty ? tab.isDirty : false,
        activeCellId:
          tab.activeCellId && action.file.cells.some((c) => c.id === tab.activeCellId)
            ? tab.activeCellId
            : action.file.cells[0]?.id ?? null,
      }));
      const activePath = state.activePath === action.path ? action.file.path : state.activePath;
      return { ...next, activePath };
    }

    case 'SET_ACTIVE_CELL':
      if (!state.activePath) return state;
      return updateTabByPath(state, state.activePath, (tab) => ({
        ...tab,
        activeCellId: action.cellId,
      }));

    case 'SET_DIRTY':
      return updateTabByPath(state, action.path, (tab) => ({
        ...tab,
        isDirty: action.dirty,
      }));

    case 'SET_KERNEL_STATUS':
      return { ...state, kernelStatus: action.status };

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };

    case 'SET_RUNNING_CELL':
      if (!state.activePath) return state;
      return updateTabByPath(state, state.activePath, (tab) => ({
        ...tab,
        runningCellId: action.cellId,
      }));

    case 'SET_SAVE_ERROR':
      return { ...state, saveError: action.error };

    case 'UPDATE_TITLE': {
      const title = action.title;
      return patchActiveFile(state, (nb) => ({ ...nb, title }));
    }

    case 'ADD_CELL': {
      const active = getActiveTab(state);
      if (!active) return state;
      const cell = createCell(action.cellType);
      return updateTabByPath(state, active.file.path, (tab) => {
        const cells = [...tab.file.cells];
        const insertAt =
          action.afterIndex !== undefined
            ? Math.min(action.afterIndex + 1, cells.length)
            : cells.length;
        cells.splice(insertAt, 0, cell);
        return {
          ...tab,
          isDirty: true,
          activeCellId: cell.id,
          file: { ...tab.file, cells },
        };
      });
    }

    case 'REMOVE_CELL': {
      const active = getActiveTab(state);
      if (!active) return state;
      const nextCells = active.file.cells.filter((c) => c.id !== action.cellId);
      return updateTabByPath(state, active.file.path, (tab) => ({
        ...tab,
        isDirty: true,
        activeCellId:
          tab.activeCellId === action.cellId
            ? nextCells[0]?.id ?? null
            : tab.activeCellId,
        file: { ...tab.file, cells: nextCells },
      }));
    }

    case 'UPDATE_CELL_SOURCE':
      return patchActiveFile(state, (nb) => ({
        ...nb,
        cells: nb.cells.map((c) =>
          c.id === action.cellId ? { ...c, source: action.source } : c
        ),
      }));

    case 'MOVE_CELL':
      return patchActiveFile(state, (nb) => {
        const idx = nb.cells.findIndex((c) => c.id === action.cellId);
        if (idx < 0) return nb;
        const target = action.direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= nb.cells.length) return nb;
        const cells = [...nb.cells];
        [cells[idx], cells[target]] = [cells[target], cells[idx]];
        return { ...nb, cells };
      });

    case 'TOGGLE_CELL_TYPE':
      return patchActiveFile(state, (nb) => ({
        ...nb,
        cells: nb.cells.map((c) => {
          if (c.id !== action.cellId) return c;
          const nextType = c.type === 'markdown' ? 'code' : 'markdown';
          return {
            ...c,
            type: nextType,
            outputs: nextType === 'markdown' ? [] : c.outputs,
            executionCount: nextType === 'markdown' ? null : c.executionCount,
          };
        }),
      }));

    case 'CLEAR_ALL_OUTPUTS':
      return patchActiveFile(state, (nb) => ({
        ...nb,
        cells: nb.cells.map((c) => ({
          ...c,
          outputs: [],
          executionCount: null,
        })),
      }));

    case 'SET_CELL_OUTPUT': {
      const active = getActiveTab(state);
      if (!active) return state;
      const markDirty = action.markDirty !== false;
      return updateTabByPath(state, active.file.path, (tab) => ({
        ...tab,
        isDirty: markDirty ? true : tab.isDirty,
        file: {
          ...tab.file,
          cells: tab.file.cells.map((c) =>
            c.id === action.cellId
              ? {
                  ...c,
                  outputs: action.outputs,
                  executionCount:
                    action.executionCount !== undefined
                      ? action.executionCount
                      : c.executionCount,
                }
              : c
          ),
        },
      }));
    }

    default:
      return state;
  }
}

const initialState: NotebookState = {
  notebookList: [],
  openTabs: [],
  activePath: null,
  kernelStatus: 'disconnected',
  connectionStatus: 'unknown',
  listLoading: false,
  saveError: null,
};

const AUTOSAVE_MS = 800;

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useNotebookStore() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [connectionConfig, setConnectionConfigState] = useState<JupyterConnectionConfig>(
    () => loadConnectionConfig()
  );

  const activeTab = getActiveTab(state);
  const activeNotebook = activeTab?.file ?? null;

  useEffect(() => {
    getConnectionConfig();
    const unsub = subscribeKernelStatus((status) => {
      dispatch({ type: 'SET_KERNEL_STATUS', status: mapJupyterStatus(status) });
    });
    return unsub;
  }, []);

  const refreshNotebookList = useCallback(async () => {
    dispatch({ type: 'SET_NOTEBOOK_LIST', list: stateRef.current.notebookList, loading: true });
    try {
      const list = await listNotebooks('');
      dispatch({ type: 'SET_NOTEBOOK_LIST', list, loading: false });
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
    } catch {
      dispatch({ type: 'SET_NOTEBOOK_LIST', list: [], loading: false });
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
    }
  }, []);

  useEffect(() => {
    void refreshNotebookList();
  }, [refreshNotebookList]);

  /** Save a specific open tab to disk. */
  const saveTab = useCallback(
    async (path: string): Promise<boolean> => {
      const tab = stateRef.current.openTabs.find((t) => t.file.path === path);
      if (!tab || !tab.isDirty) return true;
      try {
        const saved = await saveNotebookFile(tab.file);
        dispatch({ type: 'REPLACE_TAB_FILE', path, file: saved });
        dispatch({ type: 'SET_SAVE_ERROR', error: null });
        void refreshNotebookList();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Save failed';
        dispatch({ type: 'SET_SAVE_ERROR', error: message });
        return false;
      }
    },
    [refreshNotebookList]
  );

  const scheduleAutosave = useCallback(
    (path: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveTab(path);
      }, AUTOSAVE_MS);
    },
    [saveTab]
  );

  useEffect(() => {
    if (activeTab?.isDirty && activeTab.file.path) {
      scheduleAutosave(activeTab.file.path);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [activeTab?.isDirty, activeTab?.file.path, scheduleAutosave]);

  /** Bind the kernel session to a notebook path (reuses if already active). */
  const connectSession = useCallback(async (path: string) => {
    try {
      await connectNotebookSession(path);
    } catch (kernelErr) {
      const message =
        kernelErr instanceof Error ? kernelErr.message : 'Kernel connection failed';
      dispatch({ type: 'SET_SAVE_ERROR', error: message });
    }
  }, []);

  const openNotebookByPath = useCallback(
    async (path: string) => {
      // Already open as a tab → just switch + reconnect kernel.
      if (stateRef.current.openTabs.some((t) => t.file.path === path)) {
        dispatch({ type: 'SET_ACTIVE_TAB', path });
        await connectSession(path);
        return;
      }
      try {
        const file = await openNotebook(path);
        dispatch({ type: 'OPEN_TAB', notebook: file });
        dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
        dispatch({ type: 'SET_SAVE_ERROR', error: null });
        await connectSession(path);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open notebook';
        dispatch({ type: 'SET_SAVE_ERROR', error: message });
      }
    },
    [connectSession]
  );

  const setActiveTab = useCallback(
    async (path: string) => {
      if (stateRef.current.activePath === path) return;
      const current = stateRef.current.activePath;
      if (current) {
        const tab = stateRef.current.openTabs.find((t) => t.file.path === current);
        if (tab?.isDirty) await saveTab(current);
      }
      dispatch({ type: 'SET_ACTIVE_TAB', path });
      await connectSession(path);
    },
    [connectSession, saveTab]
  );

  const closeNotebook = useCallback(
    async (path: string) => {
      const tab = stateRef.current.openTabs.find((t) => t.file.path === path);
      if (tab?.isDirty) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        await saveTab(path);
      }

      const wasActive = stateRef.current.activePath === path;
      const idx = stateRef.current.openTabs.findIndex((t) => t.file.path === path);
      const remaining = stateRef.current.openTabs.filter((t) => t.file.path !== path);
      dispatch({ type: 'CLOSE_TAB', path });

      if (wasActive) {
        if (remaining.length === 0) {
          await shutdownSession();
        } else {
          const neighbor = remaining[idx] ?? remaining[idx - 1] ?? remaining[0];
          await connectSession(neighbor.file.path);
        }
      }
    },
    [connectSession, saveTab]
  );

  const createNewNotebook = useCallback(async () => {
    try {
      const name = `notebook-${Date.now()}.ipynb`;
      const file = await createNotebookFile('', name);
      dispatch({ type: 'OPEN_TAB', notebook: file });
      void refreshNotebookList();
      await connectSession(file.path);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create notebook';
      dispatch({ type: 'SET_SAVE_ERROR', error: message });
    }
  }, [connectSession, refreshNotebookList]);

  const setActiveCell = useCallback((cellId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_CELL', cellId });
  }, []);

  const updateTitle = useCallback((title: string) => {
    dispatch({ type: 'UPDATE_TITLE', title });
  }, []);

  const renameActiveNotebook = useCallback(
    async (newTitle: string) => {
      const nb = getActiveTab(stateRef.current)?.file;
      if (!nb) return;
      const trimmed = newTitle.trim() || 'Untitled';
      const currentBase = nb.path.replace(/\.ipynb$/i, '').split('/').pop() ?? '';
      const nextBase = trimmed.replace(/\.ipynb$/i, '');
      if (nextBase === currentBase) {
        dispatch({ type: 'UPDATE_TITLE', title: nextBase });
        return;
      }
      const oldPath = nb.path;
      if (
        stateRef.current.openTabs.find((t) => t.file.path === oldPath)?.isDirty
      ) {
        await saveTab(oldPath);
      }
      try {
        const renamed = await renameNotebookFile(oldPath, nextBase);
        dispatch({ type: 'REPLACE_TAB_FILE', path: oldPath, file: renamed });
        dispatch({ type: 'SET_SAVE_ERROR', error: null });
        void refreshNotebookList();
        await connectSession(renamed.path);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Rename failed';
        dispatch({ type: 'SET_SAVE_ERROR', error: message });
      }
    },
    [connectSession, refreshNotebookList, saveTab]
  );

  const importNotebookFromFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.ipynb')) {
        dispatch({ type: 'SET_SAVE_ERROR', error: 'Please choose a .ipynb file' });
        return;
      }
      try {
        const text = await readFileAsText(file);
        const content = parseIpynbFile(text);
        const uploaded = await uploadNotebookFile(file.name, content);
        dispatch({ type: 'OPEN_TAB', notebook: uploaded });
        dispatch({ type: 'SET_SAVE_ERROR', error: null });
        void refreshNotebookList();
        await connectSession(uploaded.path);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed';
        dispatch({ type: 'SET_SAVE_ERROR', error: message });
      }
    },
    [connectSession, refreshNotebookList]
  );

  const addCell = useCallback(
    (cellType: 'markdown' | 'code', afterIndex?: number) => {
      dispatch({ type: 'ADD_CELL', cellType, afterIndex });
    },
    []
  );

  const removeCell = useCallback((cellId: string) => {
    dispatch({ type: 'REMOVE_CELL', cellId });
  }, []);

  const updateCellSource = useCallback((cellId: string, source: string) => {
    dispatch({ type: 'UPDATE_CELL_SOURCE', cellId, source });
  }, []);

  const moveCellUp = useCallback((cellId: string) => {
    dispatch({ type: 'MOVE_CELL', cellId, direction: 'up' });
  }, []);

  const moveCellDown = useCallback((cellId: string) => {
    dispatch({ type: 'MOVE_CELL', cellId, direction: 'down' });
  }, []);

  const toggleCellType = useCallback((cellId: string) => {
    dispatch({ type: 'TOGGLE_CELL_TYPE', cellId });
  }, []);

  const runCell = useCallback(async (cellId: string) => {
    const active = getActiveTab(stateRef.current);
    if (!active) return;
    const nb = active.file;
    const cell = nb.cells.find((c) => c.id === cellId);
    if (!cell || cell.type !== 'code') return;
    if (active.runningCellId) return;

    dispatch({ type: 'SET_RUNNING_CELL', cellId });
    dispatch({
      type: 'SET_CELL_OUTPUT',
      cellId,
      outputs: [],
      executionCount: null,
      markDirty: false,
    });

    try {
      const result = await executeCode(nb.path, cell.source);
      dispatch({
        type: 'SET_CELL_OUTPUT',
        cellId,
        outputs: result.outputs,
        executionCount: result.executionCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({
        type: 'SET_CELL_OUTPUT',
        cellId,
        outputs: [
          {
            output_type: 'error',
            ename: 'KernelError',
            evalue: message,
            traceback: [message],
          },
        ],
      });
    } finally {
      dispatch({ type: 'SET_RUNNING_CELL', cellId: null });
    }
  }, []);

  const runAll = useCallback(async () => {
    const active = getActiveTab(stateRef.current);
    if (!active || active.runningCellId) return;

    for (const cell of active.file.cells) {
      if (cell.type !== 'code') continue;
      await runCell(cell.id);
    }
  }, [runCell]);

  const clearAllOutputs = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_OUTPUTS' });
  }, []);

  const saveNotebook = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return true;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    return saveTab(path);
  }, [saveTab]);

  const restartKernelAction = useCallback(async () => {
    try {
      await restartKernel();
    } catch (err) {
      dispatch({
        type: 'SET_SAVE_ERROR',
        error: err instanceof Error ? err.message : 'Restart failed',
      });
    }
  }, []);

  const interruptKernelAction = useCallback(async () => {
    try {
      await interruptKernel();
      dispatch({ type: 'SET_RUNNING_CELL', cellId: null });
    } catch (err) {
      dispatch({
        type: 'SET_SAVE_ERROR',
        error: err instanceof Error ? err.message : 'Interrupt failed',
      });
    }
  }, []);

  const applyConnectionConfig = useCallback(
    async (config: JupyterConnectionConfig) => {
      await shutdownSession();
      saveConnectionConfig(config);
      setConnectionConfig(config);
      setConnectionConfigState(config);
      await refreshNotebookList();
      const path = stateRef.current.activePath;
      if (path) {
        await connectSession(path);
      }
    },
    [connectSession, refreshNotebookList]
  );

  const testJupyterConnection = useCallback(async (config?: JupyterConnectionConfig) => {
    return testConnection(config ?? connectionConfig);
  }, [connectionConfig]);

  const deleteNotebookByPath = useCallback(
    async (path: string) => {
      const isOpen = stateRef.current.openTabs.some((t) => t.file.path === path);
      if (isOpen) {
        // Close tab first (without saving a file we're about to delete)
        const wasActive = stateRef.current.activePath === path;
        const idx = stateRef.current.openTabs.findIndex((t) => t.file.path === path);
        const remaining = stateRef.current.openTabs.filter((t) => t.file.path !== path);
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        dispatch({ type: 'CLOSE_TAB', path });
        if (wasActive) {
          if (remaining.length === 0) {
            await shutdownSession();
          } else {
            const neighbor = remaining[idx] ?? remaining[idx - 1] ?? remaining[0];
            await connectSession(neighbor.file.path);
          }
        }
      }
      try {
        await deleteNotebookFile(path);
        dispatch({ type: 'SET_SAVE_ERROR', error: null });
        await refreshNotebookList();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed';
        dispatch({ type: 'SET_SAVE_ERROR', error: message });
        throw err;
      }
    },
    [connectSession, refreshNotebookList]
  );

  const deleteActiveNotebook = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    await deleteNotebookByPath(path);
  }, [deleteNotebookByPath]);

  const openTabs: OpenTabInfo[] = state.openTabs.map((t) => ({
    path: t.file.path,
    title: t.file.title,
    isDirty: t.isDirty,
  }));

  return {
    notebookList: state.notebookList,
    openTabs,
    activePath: state.activePath,
    activeNotebook,
    activeCellId: activeTab?.activeCellId ?? null,
    isDirty: activeTab?.isDirty ?? false,
    kernelStatus: state.kernelStatus,
    connectionStatus: state.connectionStatus,
    runningCellId: activeTab?.runningCellId ?? null,
    listLoading: state.listLoading,
    saveError: state.saveError,
    connectionConfig,
    setActiveCell,
    setActiveTab,
    closeNotebook,
    openNotebookByPath,
    createNotebook: createNewNotebook,
    refreshNotebookList,
    updateTitle,
    renameActiveNotebook,
    importNotebookFromFile,
    deleteNotebookByPath,
    deleteActiveNotebook,
    addCell,
    removeCell,
    updateCellSource,
    moveCellUp,
    moveCellDown,
    toggleCellType,
    runCell,
    runAll,
    clearAllOutputs,
    saveNotebook,
    restartKernel: restartKernelAction,
    interruptKernel: interruptKernelAction,
    applyConnectionConfig,
    testJupyterConnection,
    notebookTitleFromPath,
  };
}

export type NotebookStore = ReturnType<typeof useNotebookStore>;
