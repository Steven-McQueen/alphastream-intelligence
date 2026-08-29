import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, FileText } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface Filing {
  [key: string]: unknown;
}

// Best-effort field extraction (FMP disclosure/prospectus shapes vary by symbol).
function pick(obj: Filing, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

function FilingList({ title, items, loading }: { title: string; items: Filing[]; loading: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-sub">
        <FileText className="h-3.5 w-3.5 text-[var(--text-author)]" />
        {title}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-dim">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-dim">No filings available</div>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((f, i) => {
            const date = pick(f, ['filingDate', 'acceptedDate', 'date']);
            const form = pick(f, ['form', 'formType', 'type']) || 'Filing';
            const link = pick(f, ['url', 'link', 'finalLink', 'reportUrl']);
            return (
              <li key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-soft">
                  <span className="font-medium text-foreground">{form}</span>
                  {date && <span className="text-dim"> · {date.slice(0, 10)}</span>}
                </span>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[hsl(var(--accent-blue-text))] hover:opacity-80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function IpoDetail({ symbol }: { symbol: string }) {
  const [disclosure, setDisclosure] = useState<Filing[]>([]);
  const [prospectus, setProspectus] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [d, p] = await Promise.all([
          fetch(`${API_BASE_URL}/api/calendar/ipos/${symbol}/disclosure`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE_URL}/api/calendar/ipos/${symbol}/prospectus`).then((r) => (r.ok ? r.json() : [])),
        ]);
        if (cancelled) return;
        setDisclosure(Array.isArray(d) ? d : []);
        setProspectus(Array.isArray(p) ? p : []);
      } catch (err) {
        console.error('Failed to load IPO detail:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <FilingList title="Disclosure" items={disclosure} loading={loading} />
      <FilingList title="Prospectus" items={prospectus} loading={loading} />
    </div>
  );
}
