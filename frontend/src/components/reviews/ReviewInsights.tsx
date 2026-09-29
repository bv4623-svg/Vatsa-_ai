"use client";

import { Sparkles } from "lucide-react";
import { Stars } from "@/components/reviews/Stars";
import { cn } from "@/lib/utils";
import { TAG_LABELS, type ReviewStats as Stats, type ReviewSummary } from "@/services/reviews";

/** Average rating and the 5→1 star breakdown; each bar filters the wall to that rating. */
export function ReviewStats({ stats, selected, onSelect }: { stats: Stats; selected?: number; onSelect: (rating?: number) => void }) {
  return (
    <section aria-label="Rating breakdown" className="rounded-xl border border-border/60 bg-card/50 p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-foreground">{stats.average !== null ? stats.average.toFixed(1) : "–"}</span>
        {stats.average !== null && <Stars value={Math.round(stats.average)} />}
        <span className="text-xs text-muted-foreground">{stats.count} review{stats.count === 1 ? "" : "s"}</span>
      </div>
      <ul className="space-y-1">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = stats.distribution[String(n) as keyof Stats["distribution"]] ?? 0;
          const pct = stats.count ? Math.round((count / stats.count) * 100) : 0;
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => onSelect(selected === n ? undefined : n)}
                aria-pressed={selected === n}
                aria-label={`${n} stars: ${count} review${count === 1 ? "" : "s"}`}
                className={cn("flex w-full items-center gap-2 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent/10", selected === n && "bg-accent/10 text-foreground")}
              >
                <span className="w-3 text-right">{n}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-8 text-right tabular-nums">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AISummaryCard({ summary }: { summary: ReviewSummary }) {
  if (!summary.text) return null;
  return (
    <section aria-label="Review summary" className="rounded-xl border border-border/60 bg-card/50 p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {summary.generated_by === "ai" ? "AI summary of reviews" : "Summary of reviews"}
      </h2>
      <p className="text-sm text-foreground/90">{summary.text}</p>
      {summary.top_tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {summary.top_tags.map((t) => (
            <span key={t.tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-muted-foreground">
              {TAG_LABELS[t.tag] ?? t.tag} · {t.count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
