import type { NbNotebookContent } from '@/types/notebook';

export function parseIpynbFile(text: string): NbNotebookContent {
  const parsed = JSON.parse(text) as NbNotebookContent;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid notebook file');
  }
  if (parsed.nbformat !== 4) {
    throw new Error('Only Jupyter notebook format v4 is supported');
  }
  if (!Array.isArray(parsed.cells)) {
    throw new Error('Notebook has no cells');
  }
  return parsed;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}
