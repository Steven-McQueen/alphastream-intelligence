export interface JupyterConnectionConfig {
  baseUrl: string;
  token: string;
  rootDir: string;
}

const STORAGE_KEY = 'alphastream.jupyter.connection.v1';

export const DEFAULT_JUPYTER_BASE_URL = 'http://localhost:8888';
export const DEFAULT_JUPYTER_ROOT_DIR = '~/alphastream-notebooks';

export function getDefaultConnectionConfig(): JupyterConnectionConfig {
  return {
    baseUrl: DEFAULT_JUPYTER_BASE_URL,
    token: '',
    rootDir: DEFAULT_JUPYTER_ROOT_DIR,
  };
}

export function loadConnectionConfig(): JupyterConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultConnectionConfig();
    const parsed = JSON.parse(raw) as Partial<JupyterConnectionConfig>;
    return {
      baseUrl: parsed.baseUrl?.trim() || DEFAULT_JUPYTER_BASE_URL,
      token: parsed.token ?? '',
      rootDir: parsed.rootDir?.trim() || DEFAULT_JUPYTER_ROOT_DIR,
    };
  } catch {
    return getDefaultConnectionConfig();
  }
}

export function saveConnectionConfig(config: JupyterConnectionConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
