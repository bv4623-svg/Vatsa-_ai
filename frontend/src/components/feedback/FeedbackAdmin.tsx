"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquarePlus, ShieldAlert, Star } from "lucide-react";

import { ListStatus, showsEmpty } from "@/components/ui/list-status";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_TYPES,
  listFeedback,
  updateFeedbackStatus,
  type FeedbackItem,
  type FeedbackStatus,
  type FeedbackType,
} from "@/services/feedback";

const STATUSES: FeedbackStatus[] = ["new", "read", "resolved"];
const TYPE_LABEL = Object.fromEntries(FEEDBACK_TYPES.map((t) => [t.value, t.label])) as Record<FeedbackType, string>;
const SELECT = "rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground";

function statusBadge(status: FeedbackStatus) {
  return cn(
    "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
    status === "new" && "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    status === "read" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
    status === "resolved" && "bg-green-500/10 text-green-600 dark:text-green-300",
  );
}

export function FeedbackAdmin() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [counts, setCounts] = useState<Record<FeedbackStatus, number> | null>(null);
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [type, setType] = useState<FeedbackType | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listFeedback({ status, type })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCounts(page.counts);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as { status?: number }).status === 403) setForbidden(true);
        else setError(err instanceof Error ? err.message : "Couldn't load feedback.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, type, reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const changeFilter = <T,>(set: (value: T) => void) => (value: T) => {
    setLoading(true);
    setError(null);
    set(value);
  };

  const setItemStatus = async (item: FeedbackItem, next: FeedbackStatus) => {
    setBusyId(item.id);
    try {
      const updated = await updateFeedbackStatus(item.id, next);
      setItems((prev) => (status && updated.status !== status ? prev.filter((i) => i.id !== item.id) : prev.map((i) => (i.id === item.id ? updated : i))));
      setCounts((prev) => (prev ? { ...prev, [item.status]: prev[item.status] - 1, [next]: prev[next] + 1 } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that feedback.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur-sm">
        <Link href="/home" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to chat
        </Link>
        <div className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
        <h1 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /> Feedback
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
              <label className="sr-only" htmlFor="feedback-status-filter">Status</label>
              <select id="feedback-status-filter" value={status} onChange={(e) => changeFilter(setStatus)(e.target.value as FeedbackStatus | "")} className={SELECT}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}{counts ? ` (${counts[s]})` : ""}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="feedback-type-filter">Type</label>
              <select id="feedback-type-filter" value={type} onChange={(e) => changeFilter(setType)(e.target.value as FeedbackType | "")} className={SELECT}>
                <option value="">All types</option>
                {FEEDBACK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <ListStatus loading={loading} error={error} count={items.length} onRetry={reload} loadingLabel="Loading feedback…" />
            {showsEmpty({ loading, error, count: items.length }) && (
              <p className="py-12 text-center text-sm text-muted-foreground">No feedback here yet.</p>
            )}

            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-border/60 bg-card/50 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={statusBadge(item.status)}>{item.status}</span>
                    <span className="font-medium text-foreground">{TYPE_LABEL[item.type] ?? item.type}</span>
                    {item.rating && (
                      <span className="flex items-center gap-0.5" aria-label={`${item.rating} of 5 stars`}>
                        {Array.from({ length: item.rating }, (_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                        ))}
                      </span>
                    )}
                    <span>{item.email ?? (item.user_id ? `user #${item.user_id}` : "anonymous")}</span>
                    <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">{item.message}</p>
                  {(item.page_url || item.user_agent) && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {item.page_url && /^https?:\/\//.test(item.page_url) && (
                        <a href={item.page_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{item.page_url}</a>
                      )}
                      {item.user_agent && <span className="ml-2">{item.user_agent}</span>}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {item.status === "new" && (
                      <button type="button" disabled={busyId === item.id} onClick={() => setItemStatus(item, "read")} className="rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:bg-accent/10 disabled:opacity-50">
                        Mark as read
                      </button>
                    )}
                    {item.status !== "resolved" ? (
                      <button type="button" disabled={busyId === item.id} onClick={() => setItemStatus(item, "resolved")} className="rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:bg-accent/10 disabled:opacity-50">
                        Resolve
                      </button>
                    ) : (
                      <button type="button" disabled={busyId === item.id} onClick={() => setItemStatus(item, "new")} className="rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:bg-accent/10 disabled:opacity-50">
                        Reopen
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
