import anser from 'anser';
import { cn } from '@/lib/utils';
import type { NbOutput } from '@/types/notebook';

interface CellOutputProps {
  outputs: NbOutput[];
}

function textFromPayload(text: string | string[] | undefined): string {
  if (!text) return '';
  return Array.isArray(text) ? text.join('') : text;
}

function ansiToHtml(text: string): string {
  return anser.ansiToHtml(text, { use_classes: false });
}

function pickMime(
  data: Record<string, string | string[] | undefined>
): { mime: string; value: string } | null {
  const order = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'text/html',
    'application/json',
    'text/plain',
  ];
  for (const mime of order) {
    const val = data[mime];
    if (val !== undefined && val !== '') {
      return { mime, value: textFromPayload(val) };
    }
  }
  return null;
}

function DisplayOutput({ output }: { output: Extract<NbOutput, { output_type: 'execute_result' | 'display_data' }> }) {
  const picked = pickMime(output.data);
  if (!picked) return null;

  const { mime, value } = picked;

  if (mime === 'image/png' || mime === 'image/jpeg') {
    const src = value.startsWith('data:')
      ? value
      : `data:${mime};base64,${value}`;
    return (
      <div className="px-4 py-2">
        <img src={src} alt="output" className="max-w-full" />
      </div>
    );
  }

  if (mime === 'image/svg+xml') {
    return (
      <div
        className="px-4 py-2 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  if (mime === 'text/html') {
    return (
      <div
        className="nb-html-output px-4 py-2 overflow-x-auto text-[13px] text-[var(--nb-fg-muted)]"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  if (mime === 'application/json') {
    let formatted = value;
    try {
      formatted = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      // keep raw
    }
    return (
      <pre className="m-0 px-4 py-2 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-[var(--nb-fg-muted)]">
        {formatted}
      </pre>
    );
  }

  return (
    <pre
      className="m-0 px-4 py-2 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-[var(--nb-fg-muted)]"
      dangerouslySetInnerHTML={{ __html: ansiToHtml(value) }}
    />
  );
}

function OutputBlock({ output, idx }: { output: NbOutput; idx: number }) {
  switch (output.output_type) {
    case 'stream':
      return (
        <pre
          key={idx}
          className={cn(
            'm-0 px-4 py-2 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-[var(--nb-fg-muted)]',
            output.name === 'stderr' && 'text-[var(--nb-error)]'
          )}
          dangerouslySetInnerHTML={{
            __html: ansiToHtml(textFromPayload(output.text)),
          }}
        />
      );
    case 'error':
      return (
        <pre
          key={idx}
          className="m-0 px-4 py-2 font-mono text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-[var(--nb-error)]"
          dangerouslySetInnerHTML={{
            __html: ansiToHtml(output.traceback.join('\n')),
          }}
        />
      );
    case 'execute_result':
    case 'display_data':
      return <DisplayOutput key={idx} output={output} />;
    default:
      return null;
  }
}

export function CellOutput({ outputs }: CellOutputProps) {
  if (outputs.length === 0) return null;

  return (
    <div className="border-t border-[var(--nb-cell-border)] bg-[var(--nb-output-bg)]">
      {outputs.map((output, idx) => (
        <OutputBlock key={idx} output={output} idx={idx} />
      ))}
    </div>
  );
}
