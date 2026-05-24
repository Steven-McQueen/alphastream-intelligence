import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SummaryItem = { label: string; text: string };
type SummarySection = { title: string; items: SummaryItem[] };

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

function MarketSummaryMiniCard({
  title,
  items,
}: {
  title: string;
  items: SummaryItem[];
}) {
  return (
    <article className="flex flex-col h-full min-w-0 bg-muted/60 rounded-lg border border-secondary/50 p-3">
      <h3 className="text-sm font-semibold text-foreground font-page-heading leading-snug mb-2.5">
        {title}
      </h3>
      <ul className="space-y-2 flex-1">
        {items.map((item) => (
          <li key={item.label} className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">{item.label}</span>{" "}
            <span className="text-muted-foreground">{item.text}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function MarketSummarySkeleton() {
  return (
    <div className="bg-sidebar-accent rounded-xl p-6 border border-border">
      <div className="flex justify-between mb-4">
        <div className="h-6 w-40 bg-muted/60 rounded pf-skeleton" />
        <div className="h-4 w-48 bg-muted/60 rounded pf-skeleton" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2 pb-4 border-b border-border/50">
          <div className="h-4 bg-muted/60 rounded pf-skeleton w-full" />
          <div className="h-4 bg-muted/60 rounded pf-skeleton w-11/12" />
          <div className="h-4 bg-muted/60 rounded pf-skeleton w-4/5" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-lg bg-muted/60 border border-secondary/50 p-3 pf-skeleton"
            />
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

  return (
    <div className="bg-sidebar-accent rounded-xl p-6 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold text-foreground font-widget-heading leading-none">
            Market Summary
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleGenerate}
                disabled={generating}
                aria-label="Refresh market summary"
              >
                <RefreshCw
                  className={cn("h-3 w-3", generating && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Refresh market summary
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {meta.date && <span>{meta.date}</span>}
          {meta.date && meta.updated && (
            <span className="hidden sm:inline text-muted-foreground/40">|</span>
          )}
          {meta.updated && (
            <span className={cn(available ? "text-primary" : "text-muted-foreground")}>
              {meta.updated}
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {!available && !error && !generating && (
        <p className="text-sm text-muted-foreground mb-4">
          No brief generated yet. Use the refresh control beside the title to generate
          from the latest market data, or wait for the hourly refresh during market hours.
        </p>
      )}

      <div
        className={cn(
          "grid gap-4 min-h-0 lg:grid-rows-[20fr_80fr]",
          generating && "opacity-60 pointer-events-none"
        )}
      >
        <section className="pb-4 border-b border-border/50 min-h-0">
          {openingSummary ? (
            <p className="text-sm text-foreground leading-relaxed">{openingSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Opening summary will appear once the daily brief has been generated.
            </p>
          )}
        </section>

        {sections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-h-0">
            {sections.map((section) => (
              <MarketSummaryMiniCard
                key={section.title}
                title={section.title}
                items={section.items}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-h-0">
            {[
              "Market Drivers",
              "Key Corporate & Earnings Moves",
              "International News",
              "Looking Ahead",
            ].map((title) => (
              <article
                key={title}
                className="flex flex-col h-full min-w-0 bg-muted/60 rounded-lg border border-secondary/50 p-3 opacity-50"
              >
                <h3 className="text-sm font-semibold text-foreground font-page-heading leading-snug mb-2.5">
                  {title}
                </h3>
                <p className="text-xs text-muted-foreground">Awaiting content</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 pt-3 border-t border-border/40 text-[10px] text-muted-foreground/55 tracking-wide">
        Powered by Google Gemini
      </p>
    </div>
  );
}
