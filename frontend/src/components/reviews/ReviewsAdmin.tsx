"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { ListStatus, showsEmpty } from "@/components/ui/list-status";
import { useToast } from "@/components/ui/use-toast";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewsLayout } from "@/components/reviews/ReviewsLayout";
import { cn } from "@/lib/utils";
import {
  REPORT_REASONS,
  banUser,
  fetchModerationQueue,
  moderateReview,
  replyToReview,
  unbanUser,
  type Review,
  type ReviewStatus,
} from "@/services/reviews";

const TABS: ReviewStatus[] = ["pending", "approved", "rejected", "hidden"];
const BTN = "rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:bg-accent/10 disabled:opacity-50";
const REASON = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

function AdminItem({ review, onDone }: { review: Review; onDone: (updated: Review | null) => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (label: string, action: () => Promise<Review | null>) => {
    setBusy(true);
    try {
      onDone(await action());
      toast({ type: "success", message: label });
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "That didn't work." });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: ReviewStatus, label: string) => run(label, () => moderateReview(review.id, { status, note: note.trim() || undefined }));

  return (
    <ReviewCard
      review={review}
      signedIn
      readOnly
      footer={
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-xs">
          <p className="text-muted-foreground">
            {review.author_email} · spam score {review.spam_score?.toFixed(2)} · {review.sentiment ?? "no"} sentiment
            {review.banned && <span className="ml-1 font-medium text-destructive">· {review.banned}-banned</span>}
          </p>
          {review.open_reports && review.open_reports.length > 0 && (
            <ul aria-label="Reports" className="space-y-0.5 text-destructive">
              {review.open_reports.map((r) => <li key={r.id}>Reported: {REASON[r.reason] ?? r.reason}{r.details ? ` · "${r.details}"` : ""}</li>)}
            </ul>
          )}
          {review.appeal_message && <p className="rounded bg-accent/10 px-2 py-1">Appeal: &ldquo;{review.appeal_message}&rdquo;</p>}
          <input
            aria-label="Note to the author (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Note to the author (optional, shown if rejected or hidden)"
            className="w-full rounded-lg border border-border/60 bg-transparent px-2.5 py-1.5 outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {review.status !== "approved" && <button type="button" disabled={busy} className={BTN} onClick={() => setStatus("approved", "Approved.")}>Approve</button>}
            {review.status !== "rejected" && <button type="button" disabled={busy} className={BTN} onClick={() => setStatus("rejected", "Rejected.")}>Reject</button>}
            {review.status !== "hidden" && <button type="button" disabled={busy} className={BTN} onClick={() => setStatus("hidden", "Hidden.")}>Hide</button>}
            <button type="button" disabled={busy} className={BTN} onClick={() => run(review.is_featured ? "Unfeatured." : "Featured.", () => moderateReview(review.id, { featured: !review.is_featured }))}>
              {review.is_featured ? "Unfeature" : "Feature"}
            </button>
            {review.banned ? (
              <button type="button" disabled={busy} className={BTN} onClick={() => run("User unbanned.", async () => { await unbanUser(review.author.id); return null; })}>Unban author</button>
            ) : (
              <>
                <button type="button" disabled={busy} className={BTN} onClick={() => run("Author shadow-banned.", async () => { await banUser(review.author.id, "shadow"); return null; })}>Shadow-ban author</button>
                <button type="button" disabled={busy} className={cn(BTN, "text-destructive")} onClick={() => window.confirm("Deactivate this account and hide all its reviews?") && run("Author banned.", async () => { await banUser(review.author.id, "full"); return null; })}>Ban author</button>
              </>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim().length >= 2) run("Reply posted.", async () => { const r = await replyToReview(review.id, reply.trim()); setReply(""); return r; });
            }}
            className="flex gap-2"
          >
            <input aria-label="Reply as the Vatsa AI team" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} placeholder="Reply as the Vatsa AI team" className="flex-1 rounded-lg border border-border/60 bg-transparent px-2.5 py-1.5 outline-none" />
            <button type="submit" disabled={busy || reply.trim().length < 2} className={BTN}>Reply</button>
          </form>
        </div>
      }
    />
  );
}

export function ReviewsAdmin() {
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [items, setItems] = useState<Review[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchModerationQueue(status)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCounts(page.counts);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as { status?: number }).status === 403) setForbidden(true);
        else setError(err instanceof Error ? err.message : "Couldn't load the queue.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const onDone = (id: number) => (updated: Review | null) => {
    // A status change moves the item to another tab; bans can change several items.
    if (!updated || updated.status !== status) reload();
    else setItems((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  return (
    <ReviewsLayout title="Review moderation">
      {forbidden ? (
        <div role="alert" className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          <p className="font-medium text-foreground">Admin access required</p>
          <p>This page is only for accounts listed in ADMIN_EMAILS, with a verified email and two-factor authentication turned on.</p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Review status" className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={status === t}
                onClick={() => {
                  if (t === status) return;
                  setLoading(true);
                  setError(null);
                  setStatus(t);
                }}
                className={cn("rounded-lg px-3 py-1.5 text-sm capitalize", status === t ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-accent/10")}
              >
                {t}{counts ? ` (${counts[t] ?? 0})` : ""}
              </button>
            ))}
            {counts && counts.open_reports > 0 && <span className="ml-auto self-center text-xs text-destructive">{counts.open_reports} open report{counts.open_reports === 1 ? "" : "s"}</span>}
          </div>
          <ListStatus loading={loading} error={error} count={items.length} onRetry={reload} loadingLabel="Loading reviews…" />
          {showsEmpty({ loading, error, count: items.length }) && <p className="py-12 text-center text-sm text-muted-foreground">Nothing {status} right now.</p>}
          <div className="columns-1 gap-4 lg:columns-2">
            {items.map((r) => <AdminItem key={r.id} review={r} onDone={onDone(r.id)} />)}
          </div>
        </>
      )}
    </ReviewsLayout>
  );
}
