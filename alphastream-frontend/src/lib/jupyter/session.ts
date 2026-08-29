import type { IKernel, ISession, KernelMessage } from '@jupyterlab/services';
import type { NbOutput } from '@/types/notebook';
import { getKernelManager, getSessionManager } from './connection';

export type JupyterKernelStatus =
  | 'disconnected'
  | 'connecting'
  | 'idle'
  | 'busy'
  | 'restarting'
  | 'dead';

type StatusListener = (status: JupyterKernelStatus) => void;

const KERNEL_START_TIMEOUT_MS = 120_000;

let activeSession: ISession.ISessionConnection | null = null;
let activeNotebookPath: string | null = null;
let statusListeners = new Set<StatusListener>();
let kernelStatusHandler: ((_: unknown, status: IKernel.Status) => void) | null = null;
let attachedKernel: IKernel.IKernelConnection | null = null;

function mapKernelStatus(status: IKernel.Status | null | undefined): JupyterKernelStatus {
  if (!status) return 'disconnected';
  switch (status) {
    case 'idle':
      return 'idle';
    case 'busy':
      return 'busy';
    case 'starting':
    case 'unknown':
      return 'connecting';
    case 'restarting':
      return 'restarting';
    case 'dead':
      return 'dead';
    default:
      return 'disconnected';
  }
}

function emitStatus(status: JupyterKernelStatus): void {
  statusListeners.forEach((fn) => fn(status));
}

function detachKernelStatus(): void {
  if (attachedKernel && kernelStatusHandler) {
    try {
      attachedKernel.statusChanged.disconnect(kernelStatusHandler);
    } catch {
      /* ignore */
    }
  }
  kernelStatusHandler = null;
  attachedKernel = null;
}

function attachKernelStatus(kernel: IKernel.IKernelConnection | null): void {
  detachKernelStatus();
  if (!kernel || kernel.isDisposed) {
    emitStatus('disconnected');
    return;
  }
  attachedKernel = kernel;
  kernelStatusHandler = () => {
    emitStatus(mapKernelStatus(kernel.status));
  };
  kernel.statusChanged.connect(kernelStatusHandler);
  emitStatus(mapKernelStatus(kernel.status));
}

function isLiveKernel(kernel: IKernel.IKernelConnection | null): kernel is IKernel.IKernelConnection {
  return Boolean(kernel && !kernel.isDisposed);
}

async function awaitKernelReady(kernel: IKernel.IKernelConnection): Promise<IKernel.IKernelConnection> {
  if (kernel.isDisposed) {
    throw new Error('Kernel was disposed');
  }
  await kernel.ready;
  if (kernel.isDisposed) {
    throw new Error('Kernel was disposed');
  }
  return kernel;
}

export function subscribeKernelStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(
    isLiveKernel(activeSession?.kernel ?? null)
      ? mapKernelStatus(activeSession!.kernel!.status)
      : 'disconnected'
  );
  return () => {
    statusListeners.delete(listener);
  };
}

export function getActiveSession(): ISession.ISessionConnection | null {
  return activeSession;
}

export async function resolvePythonKernelName(): Promise<string> {
  const km = getKernelManager();
  await km.ready;
  try {
    const specs = await km.getSpecs();
    const names = Object.keys(specs.kernelspecs ?? {});
    if (names.length === 0) return 'python3';

    const preferred = ['python3', 'python'];
    for (const name of preferred) {
      if (names.includes(name)) return name;
    }
    const pythonish = names.find((n) => /python/i.test(n));
    if (pythonish) return pythonish;
    return names[0];
  } catch {
    return 'python3';
  }
}

async function waitForKernel(
  session: ISession.ISessionConnection
): Promise<IKernel.IKernelConnection> {
  if (isLiveKernel(session.kernel)) {
    return awaitKernelReady(session.kernel);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          'Kernel did not start in time. Check that ipykernel is installed in your Python env.'
        )
      );
    }, KERNEL_START_TIMEOUT_MS);

    const onKernelChanged = (
      _: ISession.ISessionConnection,
      args: ISession.ISessionConnection.IKernelChangedArgs
    ) => {
      if (!isLiveKernel(args.newValue)) return;
      clearTimeout(timeout);
      session.kernelChanged.disconnect(onKernelChanged);
      void awaitKernelReady(args.newValue).then(resolve).catch(reject);
    };

    session.kernelChanged.connect(onKernelChanged);
  });
}

async function startSession(notebookPath: string): Promise<ISession.ISessionConnection> {
  const sm = getSessionManager();
  const km = getKernelManager();
  await km.ready;
  await sm.ready;

  const kernelName = await resolvePythonKernelName();
  const name = notebookPath.split('/').pop()?.replace(/\.ipynb$/i, '') ?? 'notebook';

  const session = await sm.startNew({
    path: notebookPath,
    type: 'notebook',
    name,
    kernel: { name: kernelName },
  });

  activeSession = session;
  activeNotebookPath = notebookPath;

  const kernel = await waitForKernel(session);
  attachKernelStatus(kernel);
  return session;
}

export async function ensureSession(notebookPath: string): Promise<ISession.ISessionConnection> {
  if (
    activeSession &&
    activeNotebookPath === notebookPath &&
    !activeSession.isDisposed &&
    isLiveKernel(activeSession.kernel)
  ) {
    await waitForKernel(activeSession);
    return activeSession;
  }

  await shutdownSession();
  emitStatus('connecting');
  return startSession(notebookPath);
}

export async function connectNotebookSession(notebookPath: string): Promise<void> {
  try {
    await ensureSession(notebookPath);
  } catch (err) {
    emitStatus('dead');
    throw err;
  }
}

export async function shutdownSession(): Promise<void> {
  detachKernelStatus();
  const session = activeSession;
  activeSession = null;
  activeNotebookPath = null;

  if (session && !session.isDisposed) {
    try {
      await session.shutdown();
    } catch {
      /* session may already be gone */
    }
  }
  emitStatus('disconnected');
}

export async function restartKernel(): Promise<void> {
  if (!activeSession || activeSession.isDisposed) {
    throw new Error('No active session');
  }
  if (!isLiveKernel(activeSession.kernel)) {
    throw new Error('No active kernel');
  }
  emitStatus('restarting');
  await activeSession.kernel.restart();
  if (isLiveKernel(activeSession.kernel)) {
    await awaitKernelReady(activeSession.kernel);
    attachKernelStatus(activeSession.kernel);
  } else {
    emitStatus('dead');
    throw new Error('Kernel did not restart');
  }
}

export async function interruptKernel(): Promise<void> {
  if (!isLiveKernel(activeSession?.kernel ?? null)) {
    throw new Error('No active kernel');
  }
  await activeSession!.kernel!.interrupt();
}

function textFromPayload(text: string | string[] | undefined): string {
  if (!text) return '';
  return Array.isArray(text) ? text.join('') : text;
}

function appendStream(
  outputs: NbOutput[],
  name: 'stdout' | 'stderr',
  text: string
): void {
  const last = outputs[outputs.length - 1];
  if (last?.output_type === 'stream' && last.name === name) {
    last.text = textFromPayload(last.text) + text;
    return;
  }
  outputs.push({ output_type: 'stream', name, text });
}

function handleIopubMessage(msg: KernelMessage.IIOPubMessage, outputs: NbOutput[]): void {
  const msgType = msg.header.msg_type;

  switch (msgType) {
    case 'stream': {
      const content = msg.content as KernelMessage.IStreamMsg['content'];
      appendStream(outputs, content.name, textFromPayload(content.text));
      break;
    }
    case 'execute_result':
    case 'display_data': {
      const content = msg.content as KernelMessage.IDisplayDataMsg['content'];
      outputs.push({
        output_type: msgType,
        data: content.data as Record<string, string | string[] | undefined>,
        metadata: content.metadata as Record<string, unknown> | undefined,
        ...(msgType === 'execute_result'
          ? {
              execution_count: (content as KernelMessage.IExecuteResultMsg['content'])
                .execution_count,
            }
          : {}),
      });
      break;
    }
    case 'error': {
      const content = msg.content as KernelMessage.IErrorMsg['content'];
      outputs.push({
        output_type: 'error',
        ename: content.ename,
        evalue: content.evalue,
        traceback: content.traceback,
      });
      break;
    }
    default:
      break;
  }
}

export interface ExecuteResult {
  outputs: NbOutput[];
  executionCount: number | null;
}

export async function executeCode(
  notebookPath: string,
  code: string
): Promise<ExecuteResult> {
  const session = await ensureSession(notebookPath);
  const kernel = session.kernel;
  if (!isLiveKernel(kernel)) {
    throw new Error('No kernel available — use Restart or reconnect');
  }

  await awaitKernelReady(kernel);

  const outputs: NbOutput[] = [];
  let executionCount: number | null = null;

  const future = kernel.requestExecute({ code }, true);

  future.onIOPub = (msg) => {
    if (msg.header.msg_type === 'execute_input') {
      const content = msg.content as KernelMessage.IExecuteInputMsg['content'];
      executionCount = content.execution_count;
    }
    handleIopubMessage(msg, outputs);
  };

  const reply = await future.done;
  if (reply.content.status === 'error') {
    const content = reply.content as KernelMessage.IExecuteReplyMsg['content'];
    if (content.traceback?.length) {
      outputs.push({
        output_type: 'error',
        ename: content.ename ?? 'Error',
        evalue: content.evalue ?? '',
        traceback: content.traceback,
      });
    } else if (content.evalue) {
      outputs.push({
        output_type: 'error',
        ename: content.ename ?? 'Error',
        evalue: content.evalue,
        traceback: [content.evalue],
      });
    }
  }

  return { outputs, executionCount };
}
