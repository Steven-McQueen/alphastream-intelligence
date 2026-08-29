import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshCw, CalendarClock } from "lucide-react";
import { API_BASE_URL } from "@/config/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStockDetail } from "@/contexts/StockDetailContext";
import type { Stock } from "@/types";
import { cn } from "@/lib/utils";

type Spotlight = {
  symbol: string;
  company: string;
  date: string;
  why: string;
};

interface EarningsSummaryResponse {
  openingSummary: string | null;
  spotlights: Spotlight[];
  meta: { date: string; updated: string };
  generated_at: string | null;
  available: boolean;
  range?: { start: string; end: string };
}

function validatePayload(json: unknown): json is EarningsSummaryResponse {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  if (typeof o.available !== "boolean") return false;
  if (o.openingSummary !== null && typeof o.openingSummary !== "string") return false;
  if (!Array.isArray(o.spotlights)) return false;
  return true;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Small uppercase eyebrow with turquoise accent bar (matches market summary). */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sub">
        {children}
      </span>
    </div>
  );
}

/** Compact numbered spotlight row: index + ticker + date chip + reason. */
function SpotlightRow({
  index,
  item,
  onClick,
  className,
}: {
  index: number;
  item: Spotlight;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn('group flex w-full items-start gap-3 py-2.5 text-left', className)}
    >
      <span className="shrink-0 pt-[2px] text-[11px] font-semibold tabular-nums text-[var(--text-author)]">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground transition-colors group-hover:text-[var(--text-author)]">
            {item.symbol}
          </span>
          {item.date && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sub">
              {formatShortDate(item.date)}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-sub">{item.why}</p>
      </div>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="bg-sidebar-accent rounded-xl border border-border p-6 lg:p-7">
      <div className="flex justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-muted" />
          <div className="pf-skeleton h-7 w-52 rounded bg-muted/60" />
        </div>
        <div className="pf-skeleton h-6 w-28 rounded-full bg-muted/60" />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="pf-skeleton h-4 w-full rounded bg-muted/60" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pf-skeleton h-20 w-full rounded-lg bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

export function EarningsSpotlight() {
  const { openStockDetail } = useStockDetail();
  const [data, setData] = useState<EarningsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/earnings/earnings-summary`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: unknown = await res.json();
      if (!validatePayload(json)) throw new Error("Invalid earnings summary response shape");
      setData(json);
    } catch (err) {
      console.error("Error fetching earnings summary:", err);
      setError("Unable to load the earnings spotlight.");
      setData(null);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    // Earnings change daily, not intraday - a slow refresh is enough.
    const interval = setInterval(() => fetchSummary({ silent: true }), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/earnings/earnings-summary/refresh`, {
        method: "POST",
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          body && typeof body === "object" && "detail" in body &&
          typeof (body as { detail: unknown }).detail === "string"
            ? (body as { detail: string }).detail
            : `Generation failed (${res.status})`;
        throw new Error(detail);
      }
      if (!validatePayload(body)) throw new Error("Invalid response from generation endpoint");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate earnings spotlight.");
      console.error("Error generating earnings summary:", err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading && !data) return <Skeleton />;

  const meta = data?.meta ?? { date: "", updated: "" };
  const openingSummary = data?.openingSummary;
  const spotlights = data?.spotlights ?? [];
  const available = data?.available ?? false;

  return (
    <div className="bg-sidebar-accent rounded-xl border border-border p-6 lg:p-7">
      {/* Masthead */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
          <h2 className="font-page-heading text-2xl font-semibold leading-none text-foreground">
            Earnings Spotlight
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-dim hover:bg-muted hover:text-foreground"
                onClick={handleGenerate}
                disabled={generating}
                aria-label="Refresh earnings spotlight"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", generating && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Refresh earnings spotlight
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 text-xs text-dim">
          <CalendarClock className="h-3.5 w-3.5" />
          <span>Next 10 trading days</span>
          {available && meta.updated && <span className="text-dim/50">&middot;</span>}
          {available && meta.updated && <span>{meta.updated}</span>}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!available && !error && !generating && (
        <p className="mt-4 text-sm text-muted-foreground">
          No spotlight generated yet. Use the refresh control beside the title to generate
          one from the upcoming earnings calendar.
        </p>
      )}

      <div className={cn("mt-5 space-y-6 transition-opacity", generating && "pointer-events-none opacity-50")}>
        {/* Top row: opening brief (wide) + the 5 headline names (narrow), like the
            front-page Market Summary so the card stays compact. */}
        <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-[1.7fr_1fr] lg:gap-x-12">
          <section className="min-w-0 space-y-3">
            <Eyebrow>The Setup</Eyebrow>
            {openingSummary ? (
              <p className="font-page-heading text-[17px] leading-[1.75] text-soft lg:text-lg">
                {openingSummary}
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                The upcoming-earnings brief will appear once generated.
              </p>
            )}
          </section>

          <section className="min-w-0 space-y-2">
            <Eyebrow>Names to Watch</Eyebrow>
            {spotlights.length > 0 ? (
              <ul className="divide-y divide-border/40">
                {spotlights.slice(0, 5).map((s, i) => (
                  <li key={`${s.symbol}-${s.date}`}>
                    <SpotlightRow
                      index={i}
                      item={s}
                      onClick={() =>
                        openStockDetail({ ticker: s.symbol, name: s.company } as unknown as Stock)
                      }
                      className="first:pt-0"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Awaiting content</p>
            )}
          </section>
        </div>

        {/* Bottom row: the next 5 names in a compact two-column list. */}
        {spotlights.length > 5 && (
          <div className="space-y-2 border-t border-border pt-4">
            <Eyebrow>More Reports</Eyebrow>
            <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
              {spotlights.slice(5, 10).map((s, i) => (
                <SpotlightRow
                  key={`${s.symbol}-${s.date}`}
                  index={i + 5}
                  item={s}
                  onClick={() =>
                    openStockDetail({ ticker: s.symbol, name: s.company } as unknown as Stock)
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-5 border-t border-border/40 pt-3 text-[10px] uppercase tracking-[0.14em] text-dim/70">
        Powered by Google Gemini
      </p>
    </div>
  );
}
