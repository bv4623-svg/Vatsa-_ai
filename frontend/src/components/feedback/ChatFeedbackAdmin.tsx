"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, ThumbsUp } from "lucide-react";

import { RatingsChart } from "@/components/feedback/RatingsChart";
import { ListStatus } from "@/components/ui/list-status";
import { ratingStats, reasonLabel, type RatingStats } from "@/services/chatFeedback";

const RANGES = [7, 30, 90] as const;
const SELECT = "rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** /admin/chat-feedback: how people rate the assistant's replies (👍/👎 and
 * the reasons given for 👎). Admin-only, like /admin/feedback. */
export function ChatFeedbackAdmin() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    ratingStats(days)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as { status?: number }).status === 403) setForbidden(true);
        else setError(err instanceof Error ? err.message : "Couldn't load the ratings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const pickRange = (value: string) => {
    setLoading(true);
    setError(null);
    setDays(Number(value) as (typeof RANGES)[number]);
  };

  const reasonTotal = stats ? stats.down : 0;

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur-sm">
        <Link href="/home" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to chat
        </Link>
        <div className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
        <h1 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ThumbsUp className="h-4 w-4" aria-hidden="true" /> Chat ratings
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {forbidden ? (
          <div role="alert" className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
            <p className="font-medium text-foreground">Admin access required</p>
            <p>This page is only for accounts listed in ADMIN_EMAILS, with a verified email and two-factor authentication turned on.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="ratings-range">Period</label>
              <select id="ratings-range" value={days} onChange={(e) => pickRange(e.target.value)} className={SELECT}>
                {RANGES.map((d) => (
                  <option key={d} value={d}>Last {d} days</option>
                ))}
              </select>
            </div>

            <ListStatus loading={loading} error={error} count={stats ? 1 : 0} onRetry={reload} loadingLabel="Loading ratings…" />

            {stats && !loading && !error && (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Tile label="Ratings" value={String(stats.total)} />
                  <Tile label="Helpful 👍" value={String(stats.up)} />
                  <Tile label="Not helpful 👎" value={String(stats.down)} />
                  <Tile label="Helpful share" value={stats.satisfaction === null ? "–" : `${Math.round(stats.satisfaction * 100)}%`} />
                </div>

                {stats.total === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No ratings in the last {stats.days} days yet.</p>
                ) : (
                  <RatingsChart days={stats.by_day} />
                )}

                <section aria-labelledby="reasons-heading" className="rounded-xl border border-border/60 bg-card/50 p-4">
                  <h2 id="reasons-heading" className="mb-2 text-sm font-medium text-foreground">Why replies were rated 👎</h2>
                  {reasonTotal === 0 ? (
                    <p className="text-sm text-muted-foreground">No thumbs-down in this period.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th scope="col" className="py-1.5 font-medium">Reason</th>
                          <th scope="col" className="py-1.5 text-right font-medium">Count</th>
                          <th scope="col" className="py-1.5 text-right font-medium">Share of 👎</th>
                        </tr>
                      </thead>
                      <tbody className="text-foreground">
                        {[...stats.top_reasons.map((r) => ({ label: reasonLabel(r.reason), count: r.count })),
                          ...(stats.down_without_reason ? [{ label: "No reason given", count: stats.down_without_reason }] : [])].map((row) => (
                          <tr key={row.label} className="border-t border-border/40">
                            <td className="py-1.5">{row.label}</td>
                            <td className="py-1.5 text-right tabular-nums">{row.count}</td>
                            <td className="py-1.5 text-right tabular-nums">{Math.round((row.count / reasonTotal) * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
