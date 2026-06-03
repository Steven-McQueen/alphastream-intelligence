import {
  ContentsManager,
  KernelManager,
  ServerConnection,
  SessionManager,
} from '@jupyterlab/services';
import {
  loadConnectionConfig,
  type JupyterConnectionConfig,
} from './connectionConfig';

export type ConnectionTestResult =
  | { ok: true; version?: string }
  | { ok: false; error: string };

let currentConfig: JupyterConnectionConfig | null = null;
let serverSettings: ServerConnection.ISettings | null = null;
let kernelManager: KernelManager | null = null;
let sessionManager: SessionManager | null = null;
let contentsManager: ContentsManager | null = null;

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function buildServerSettings(
  config: JupyterConnectionConfig
): ServerConnection.ISettings {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const token = config.token.trim();
  const wsUrl = baseUrl.replace(/^http/, 'ws');

  return ServerConnection.makeSettings({
    baseUrl,
    wsUrl,
    token: token || undefined,
    appendToken: true,
    init: {
      credentials: 'omit',
    },
  });
}

function disposeManagers(): void {
  try {
    sessionManager?.dispose();
  } catch {
    /* ignore */
  }
  try {
    kernelManager?.dispose();
  } catch {
    /* ignore */
  }
  sessionManager = null;
  kernelManager = null;
  contentsManager = null;
}

function rebuildManagers(config: JupyterConnectionConfig): void {
  disposeManagers();
  currentConfig = config;
  serverSettings = buildServerSettings(config);
  kernelManager = new KernelManager({ serverSettings });
  // SessionManager requires kernelManager — without it, .isActive throws.
  sessionManager = new SessionManager({ serverSettings, kernelManager });
  contentsManager = new ContentsManager({ serverSettings });
}

export function getConnectionConfig(): JupyterConnectionConfig {
  if (!currentConfig) {
    currentConfig = loadConnectionConfig();
    rebuildManagers(currentConfig);
  }
  return currentConfig;
}

export function setConnectionConfig(config: JupyterConnectionConfig): void {
  rebuildManagers(config);
}

export function getServerSettings(): ServerConnection.ISettings {
  getConnectionConfig();
  return serverSettings!;
}

export function getKernelManager(): KernelManager {
  getConnectionConfig();
  return kernelManager!;
}

export function getSessionManager(): SessionManager {
  getConnectionConfig();
  return sessionManager!;
}

export function getContentsManager(): ContentsManager {
  getConnectionConfig();
  return contentsManager!;
}

export async function testConnection(
  config?: JupyterConnectionConfig
): Promise<ConnectionTestResult> {
  const cfg = config ?? getConnectionConfig();
  const settings = buildServerSettings(cfg);
  try {
    const url = `${settings.baseUrl}api/status`;
    const response = await ServerConnection.makeRequest(url, {}, settings);
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Unauthorized — check your token' };
    }
    if (!response.ok) {
      return { ok: false, error: `Server returned ${response.status}` };
    }
    const data = (await response.json()) as { version?: string };
    return { ok: true, version: data.version };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not reach Jupyter server';
    return { ok: false, error: message };
  }
}
