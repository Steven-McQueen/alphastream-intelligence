/**
 * Frontend-only export helpers for chat assistant messages.
 *
 * Everything here runs in the browser with no backend dependency:
 *  - copyText  : clipboard copy
 *  - downloadMarkdown : raw .md file
 *  - downloadDoc      : Word-openable .doc (HTML payload)
 *  - exportPdf        : opens a print window so the user can "Save as PDF"
 */

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function defaultExportName(): string {
  return `alphastream-response-${timestampSlug()}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / insecure contexts.
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has time to register.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadMarkdown(content: string, name = defaultExportName()): void {
  triggerDownload(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${name}.md`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Minimal HTML wrapper that preserves line breaks; opens cleanly in Word/Docs. */
function contentToHtml(content: string, title: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: Georgia, 'Source Serif 4', serif; font-size: 12pt; line-height: 1.6; color: #111; white-space: pre-wrap; max-width: 46rem; margin: 2rem auto; padding: 0 1rem;">${escapeHtml(content)}</body></html>`;
}

export function downloadDoc(content: string, name = defaultExportName()): void {
  const html = contentToHtml(content, name);
  triggerDownload(new Blob([html], { type: 'application/msword' }), `${name}.doc`);
}

export function exportPdf(content: string, name = defaultExportName()): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=820,height=900');
  if (!win) return;
  win.document.write(contentToHtml(content, name));
  win.document.close();
  win.focus();
  // Give the new document a tick to lay out before invoking print.
  setTimeout(() => {
    win.print();
  }, 200);
}
