import { useEffect, useState } from "react";
import { FileText, Download, Loader2, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/config/api";

interface AnnualReport {
  form: string;
  filingDate: string;
  year: string | null;
  cik: string | null;
  link: string | null;
  finalLink: string | null;
}

export function AnnualReports({ ticker }: { ticker: string }) {
  const [reports, setReports] = useState<AnnualReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${ticker}/annual-reports`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching annual reports:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <div className="border-t border-border p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Annual Reports</h3>
        <span className="text-xs text-dim">SEC EDGAR · 10-K filings</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-1 py-4 text-sm text-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading filings...
        </div>
      ) : reports.length === 0 ? (
        <div className="px-1 py-4 text-sm text-dim">No SEC annual reports found for this company.</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r, i) => (
            <a
              key={`${r.form}-${r.filingDate}-${i}`}
              href={r.finalLink || r.link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:border-[var(--text-author)]/50 hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-[var(--text-author)]" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {r.form} {r.year ? `· ${r.year}` : ""}
                  </div>
                  <div className="text-xs text-dim">Filed {r.filingDate || "—"}</div>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                <Download className="h-3.5 w-3.5" />
              </span>
            </a>
          ))}
        </div>
      )}

      <p className="mt-3 flex items-center gap-1 text-[11px] text-dim">
        <ExternalLink className="h-3 w-3" />
        Documents open directly on sec.gov
      </p>
    </div>
  );
}
