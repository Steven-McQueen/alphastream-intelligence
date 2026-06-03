import type { Contents } from '@jupyterlab/services';
import {
  createEmptyNbNotebook,
  nbContentToNotebookFile,
  notebookFileToNbContent,
  type NbNotebookContent,
  type NotebookFile,
  type NotebookListItem,
} from '@/types/notebook';
import { getContentsManager } from './connection';

function isNotebookModel(
  model: Contents.IModel
): model is Contents.IModel & { content: NbNotebookContent } {
  return model.type === 'notebook';
}

export async function listNotebooks(dir = ''): Promise<NotebookListItem[]> {
  const cm = getContentsManager();
  const listing = await cm.get(dir, { content: true });
  const items: NotebookListItem[] = [];

  for (const item of listing.content ?? []) {
    if (item.type === 'notebook') {
      items.push({
        path: item.path,
        name: item.name,
        lastModified: item.last_modified,
      });
    } else if (item.type === 'directory') {
      try {
        const nested = await listNotebooks(item.path);
        items.push(...nested);
      } catch {
        // skip unreadable directories
      }
    }
  }

  return items.sort((a, b) => {
    const ta = a.lastModified ?? '';
    const tb = b.lastModified ?? '';
    return tb.localeCompare(ta);
  });
}

export async function openNotebook(path: string): Promise<NotebookFile> {
  const cm = getContentsManager();
  const model = await cm.get(path, { content: true });
  if (!isNotebookModel(model)) {
    throw new Error('Not a notebook file');
  }
  return nbContentToNotebookFile(path, model.content, model.last_modified);
}

export async function createNotebook(
  dir: string,
  name: string
): Promise<NotebookFile> {
  const cm = getContentsManager();
  const base = name.endsWith('.ipynb') ? name : `${name}.ipynb`;
  const path = dir ? `${dir.replace(/\/+$/, '')}/${base}` : base;
  const content = createEmptyNbNotebook(base.replace(/\.ipynb$/i, ''));
  const model = await cm.save(path, { type: 'notebook', content });
  // The save response omits content; fall back to what we just wrote.
  return nbContentToNotebookFile(path, model.content ?? content, model.last_modified);
}

export async function saveNotebook(file: NotebookFile): Promise<NotebookFile> {
  const cm = getContentsManager();
  const content = notebookFileToNbContent(file);
  const model = await cm.save(file.path, { type: 'notebook', content });
  // The save response omits content; preserve the in-memory cells (with their
  // stable ids and outputs) and only adopt the fresh modification time.
  return { ...file, lastModified: model.last_modified ?? file.lastModified };
}

export async function deleteNotebook(path: string): Promise<void> {
  const cm = getContentsManager();
  await cm.delete(path);
}

/** Rename/move a notebook on the Jupyter server (same directory). */
export async function renameNotebook(
  oldPath: string,
  newName: string
): Promise<NotebookFile> {
  const cm = getContentsManager();
  const base = newName.endsWith('.ipynb') ? newName : `${newName}.ipynb`;
  const dir = oldPath.includes('/')
    ? oldPath.slice(0, oldPath.lastIndexOf('/'))
    : '';
  const newPath = dir ? `${dir}/${base}` : base;

  if (newPath === oldPath) {
    return openNotebook(oldPath);
  }

  await cm.rename(oldPath, newPath);
  return openNotebook(newPath);
}

/** Save parsed notebook content as a new file on the server. */
export async function uploadNotebook(
  fileName: string,
  content: NbNotebookContent
): Promise<NotebookFile> {
  const cm = getContentsManager();
  const base = fileName.endsWith('.ipynb') ? fileName : `${fileName}.ipynb`;
  const path = base;
  const model = await cm.save(path, { type: 'notebook', content });
  // The save response omits content; fall back to what we just uploaded.
  return nbContentToNotebookFile(path, model.content ?? content, model.last_modified);
}
