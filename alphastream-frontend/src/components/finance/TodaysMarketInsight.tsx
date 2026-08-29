import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config/api";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTimezone } from "@/hooks/useTimezone";
import { cn } from "@/lib/utils";

/**
 * Format the brief's absolute generation timestamp into a localized date +
 * "Updated HH:MM TZ" label in the user's selected display timezone.
 * Returns null when no timestamp is available (callers fall back to the
 * server-provided meta strings).
 */
function formatBriefMeta(
  iso: string | null | undefined,
  timeZone: string
): { date: string; updated: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(d);
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
    timeZoneName: "short",
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "";
  const zone = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  return { date, updated: `Updated ${hh}:${mm}${zone ? ` ${zone}` : ""}` };
}

type SummaryItem = { label: string; text: string };
type SummarySection = { title: string; items: SummaryItem[] };

// Title of the section that sits beside the opening summary (right column).
// All remaining sections render as collapsible dropdowns underneath.
const PRIMARY_SECTION_TITLE = "Market Drivers";

interface MarketSummaryResponse {
  openingSummary: string | null;
  sections: SummarySection[];
  meta: { date: string; updated: string };
  generated_at: string | null;
  available: boolean;
}

function validateSummaryPayload(json: unknown): json is MarketSummaryResponse {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  if (typeof o.available !== "boolean") return false;
  if (o.openingSummary !== null && typeof o.openingSummary !== "string") return false;
  if (!Array.isArray(o.sections)) return false;
  return true;
}

/** A small uppercase eyebrow label with a turquoise accent bar (matches News page). */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-3.5 w-1 rounded-full bg-[var(--text-author)]"
        aria-hidden
      />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sub">
        {children}
      </span>
    </div>
  );
}

/** A single numbered brief item: accent index + bold label + muted body. */
function SummaryItemRow({
  index,
  item,
  className,
}: {
  index: number;
  item: SummaryItem;
  className?: string;
}) {
  return (
    <li className={cn("flex gap-3", className)}>
      <span className="shrink-0 pt-[2px] text-[11px] font-semibold tabular-nums text-[var(--text-author)]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <p className="text-[13px] leading-relaxed">
        <span className="font-semibold text-soft">{item.label}</span>{" "}
        <span className="text-sub">{item.text}</span>
      </p>
    </li>
  );
}

/** Right-hand "Market Drivers" column: numbered, newsletter-style item list. */
function MarketDriversColumn({ items }: { items: SummaryItem[] }) {
  return (
    <ul className="divide-y divide-border/40">
      {items.map((item, index) => (
        <SummaryItemRow
          key={item.label}
          index={index}
          item={item}
          className="py-2.5 first:pt-0 last:pb-0"
        />
      ))}
    </ul>
  );
}

/** A collapsible "continued read" section rendered as a dropdown row. */
function MarketSummaryDropdown({
  title,
  items,
}: {
  title: string;
  items: SummaryItem[];
}) {
  return (
    <AccordionItem
      value={title}
      className="border-b border-border/50 last:border-b-0"
    >
      <AccordionTrigger className="group py-3.5 hover:no-underline [&>svg]:text-dim [&>svg]:group-hover:text-foreground">
        <span className="flex items-center gap-3 text-left">
          <span
            className="h-4 w-1 rounded-full bg-[var(--text-author)]/60 transition-colors group-hover:bg-[var(--text-author)]"
            aria-hidden
          />
          <span className="font-page-heading text-[15px] font-semibold leading-snug text-foreground">
            {title}
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sub">
            {items.length}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <ul className="space-y-3 pl-4">
          {items.map((item, index) => (
            <SummaryItemRow key={item.label} index={index} item={item} />
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

function MarketSummarySkeleton() {
  return (
    <div className="bg-sidebar-accent rounded-xl border border-border p-6 lg:p-7">
      <div className="flex justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-muted" />
          <div className="pf-skeleton h-7 w-48 rounded bg-muted/60" />
        </div>
        <div className="pf-skeleton h-6 w-32 rounded-full bg-muted/60" />
      </div>
      <div className="mt-5 space-y-6">
        <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-[1.7fr_1fr] lg:gap-x-16">
          <div className="space-y-2.5">
            <div className="pf-skeleton h-3 w-24 rounded bg-muted/60" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "pf-skeleton h-4 rounded bg-muted/60",
                  i % 3 === 2 ? "w-4/5" : "w-full"
                )}
              />
            ))}
          </div>
          <div className="space-y-3">
            <div className="pf-skeleton h-3 w-28 rounded bg-muted/60" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="pf-skeleton h-4 w-full rounded bg-muted/60" />
            ))}
          </div>
        </div>
        <div className="border-t border-border pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pf-skeleton my-3 h-5 w-56 rounded bg-muted/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TodaysMarketInsight() {
  const [data, setData] = useState<MarketSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { resolved: timeZone } = useTimezone();
  const fetchSummary = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/market/market-summary`);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const json: unknown = await res.json();
      if (!validateSummaryPayload(json)) {
        throw new Error("Invalid market summary response shape");
      }
      setData(json);
      return json;
    } catch (err) {
      console.error("Error fetching market summary:", err);
      setError("Unable to load market summary.");
      setData(null);
      return null;
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(() => fetchSummary({ silent: true }), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/market/market-summary/refresh`, {
        method: "POST",
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          body &&
          typeof body === "object" &&
          "detail" in body &&
          typeof (body as { detail: unknown }).detail === "string"
            ? (body as { detail: string }).detail
            : `Generation failed (${res.status})`;
        throw new Error(detail);
      }
      if (!validateSummaryPayload(body)) {
        throw new Error("Invalid response from generation endpoint");
      }
      setData(body);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate market summary.";
      setError(message);
      console.error("Error generating market summary:", err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading && !data) {
    return <MarketSummarySkeleton />;
  }

  const meta = data?.meta ?? { date: "", updated: "" };
  const openingSummary = data?.openingSummary;
  const sections = data?.sections ?? [];
  const available = data?.available ?? false;

  // Render the date/time in the user's selected display timezone (defaults to
  // the device timezone), derived from the absolute generation timestamp.
  // Falls back to the server-formatted strings if no timestamp is present.
  const localized = formatBriefMeta(data?.generated_at, timeZone);
  const displayDate = localized?.date ?? meta.date;
  const displayUpdated = localized?.updated ?? meta.updated;

  // Market Drivers sits beside the opening summary; the rest become dropdowns.
  const primarySection =
    sections.find((s) => s.title === PRIMARY_SECTION_TITLE) ?? null;
  const dropdownSections = sections.filter(
    (s) => s.title !== PRIMARY_SECTION_TITLE
  );
  const fallbackDropdownTitles = [
    "Key Corporate & Earnings Moves",
    "International News",
    "Looking Ahead",
  ];

  return (
    <div className="bg-sidebar-accent rounded-xl border border-border p-6 lg:p-7">
      {/* Masthead */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <span
            className="h-6 w-1 rounded-full bg-[var(--text-author)]"
            aria-hidden
          />
          <h2 className="font-page-heading text-2xl font-semibold leading-none text-foreground">
            Market Summary
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-dim hover:text-foreground hover:bg-muted"
                onClick={handleGenerate}
                disabled={generating}
                aria-label="Refresh market summary"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", generating && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Refresh market summary
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 text-xs text-dim">
          {available && (
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
            </span>
          )}
          {displayDate && <span>{displayDate}</span>}
          {displayDate && displayUpdated && <span className="text-dim/50">&middot;</span>}
          {displayUpdated && <span>{displayUpdated}</span>}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!available && !error && !generating && (
        <p className="mt-4 text-sm text-muted-foreground">
          No brief generated yet. Use the refresh control beside the title to generate
          from the latest market data, or wait for the hourly refresh during market hours.
        </p>
      )}

      <div
        className={cn(
          "mt-5 space-y-6 transition-opacity",
          generating && "pointer-events-none opacity-50"
        )}
      >
        {/* Top row: opening brief (wide) + Market Drivers (narrow), split slightly right */}
        <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-[1.7fr_1fr] lg:gap-x-16">
          <section className="min-w-0 space-y-3">
            <Eyebrow>Today&apos;s Brief</Eyebrow>
            {openingSummary ? (
              <div className="space-y-3.5">
                {openingSummary
                  .split(/\n+/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <p
                      key={i}
                      className="font-page-heading text-[17px] leading-[1.75] text-soft text-justify hyphens-auto lg:text-lg"
                    >
                      {para}
                    </p>
                  ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Opening summary will appear once the daily brief has been generated.
              </p>
            )}
          </section>

          <section className="min-w-0 space-y-3">
            <Eyebrow>{PRIMARY_SECTION_TITLE}</Eyebrow>
            {primarySection ? (
              <MarketDriversColumn items={primarySection.items} />
            ) : (
              <p className="text-xs text-muted-foreground">Awaiting content</p>
            )}
          </section>
        </div>

        {/* Continued read: collapsible dropdown sections */}
        {dropdownSections.length > 0 ? (
          <Accordion type="multiple" className="border-t border-border">
            {dropdownSections.map((section) => (
              <MarketSummaryDropdown
                key={section.title}
                title={section.title}
                items={section.items}
              />
            ))}
          </Accordion>
        ) : (
          <div className="border-t border-border">
            {fallbackDropdownTitles.map((title) => (
              <div
                key={title}
                className="flex items-center gap-3 border-b border-border/50 py-3.5 opacity-50 last:border-b-0"
              >
                <span
                  className="h-4 w-1 rounded-full bg-[var(--text-author)]/40"
                  aria-hidden
                />
                <span className="font-page-heading text-[15px] font-semibold leading-snug text-foreground">
                  {title}
                </span>
                <span className="text-xs text-dim">Awaiting content</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-5 border-t border-border/40 pt-3 text-[10px] uppercase tracking-[0.14em] text-dim/70">
        Powered by Google Gemini
      </p>
    </div>
  );
}
