"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Flag, Pin, PinOff, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

import { RelativeTime } from "@/components/home/RelativeTime";
import { ReportModal } from "@/components/reviews/ReportModal";
import { Stars } from "@/components/reviews/Stars";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { TAG_LABELS, pinReview, replyToReview, unpinReview, voteReview, type Review, type VoteType } from "@/services/reviews";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  approved: "bg-green-500/10 text-green-600 dark:text-green-300",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-300",
  hidden: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
};

const ACTION = "flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-accent/10 disabled:opacity-50";

interface ReviewCardProps {
  review: Review;
  signedIn: boolean;
  onChange?: (review: Review) => void;
  /** Hides votes/pin/report: used for the author's own list and the admin queue. */
  readOnly?: boolean;
  footer?: ReactNode;
}

export function ReviewCard({ review, signedIn, onChange, readOnly, footer }: ReviewCardProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [reply, setReply] = useState("");
  const update = (patch: Partial<Review>) => onChange?.({ ...review, ...patch });
  const pathname = usePathname() ?? "/wall";
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  const vote = async (type: VoteType) => {
    const previous = review;
    // Optimistic: the counts move immediately and roll back on failure.
    const undo = review.my_vote === type;
    const delta = (t: VoteType) => (t === type ? (undo ? -1 : 1) : review.my_vote === t ? -1 : 0);
    update({
      my_vote: undo ? null : type,
      helpful_count: review.helpful_count + delta("helpful"),
      not_helpful_count: review.not_helpful_count + delta("not_helpful"),
    });
    setBusy(true);
    try {
      update(await voteReview(review.id, type));
    } catch (err) {
      onChange?.(previous);
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't save your vote." });
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async () => {
    const pinned = review.pinned;
    update({ pinned: !pinned });
    try {
      if (pinned) await unpinReview(review.id);
      else await pinReview(review.id);
      toast({ type: "success", message: pinned ? "Removed from your wall." : "Pinned to your wall." });
    } catch (err) {
      update({ pinned });
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't update your wall." });
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reply.trim().length < 2) return;
    setBusy(true);
    try {
      onChange?.(await replyToReview(review.id, reply.trim()));
      setReply("");
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't send your reply." });
    } finally {
      setBusy(false);
    }
  };

  const hasTeamReply = review.replies.some((r) => r.is_owner);

  return (
    <article aria-label={`Review by ${review.author.name}`} className="mb-4 break-inside-avoid rounded-xl border border-border/60 bg-card/50 p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Stars value={review.rating} />
        <span className="font-medium text-foreground">{review.author.name}</span>
        {review.is_verified && (
          <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" title="Paying customer or active user">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
          </span>
        )}
        {review.is_featured && (
          <span className="flex items-center gap-0.5 text-violet-600 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Featured
          </span>
        )}
        <RelativeTime date={review.created_at} />
        {review.edited && <span>(edited)</span>}
        {review.status && review.status !== "approved" && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[review.status])}>{review.status}</span>
        )}
      </header>

      {review.title && <h3 className="mb-1 text-sm font-semibold text-foreground">{review.title}</h3>}
      <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">{review.body}</p>

      {(review.pros.length > 0 || review.cons.length > 0) && (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {review.pros.length > 0 && (
            <ul aria-label="Pros" className="space-y-0.5">
              {review.pros.map((p) => <li key={p} className="text-green-700 dark:text-green-400">+ {p}</li>)}
            </ul>
          )}
          {review.cons.length > 0 && (
            <ul aria-label="Cons" className="space-y-0.5">
              {review.cons.map((c) => <li key={c} className="text-red-700 dark:text-red-400">− {c}</li>)}
            </ul>
          )}
        </div>
      )}

      {review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {review.tags.map((t) => (
            <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-muted-foreground">{TAG_LABELS[t] ?? t}</span>
          ))}
        </div>
      )}

      {review.status && review.status !== "approved" && review.moderation_note && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{review.moderation_note}</p>
      )}

      {review.replies.length > 0 && (
        <ol aria-label="Replies" className="mt-3 space-y-2 border-l-2 border-border/60 pl-3">
          {review.replies.map((r) => (
            <li key={r.id} className="text-xs">
              <span className={cn("font-medium", r.is_owner ? "text-violet-600 dark:text-violet-300" : "text-foreground")}>{r.author_name}</span>{" "}
              <RelativeTime date={r.created_at} className="text-muted-foreground" />
              <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{r.body}</p>
            </li>
          ))}
        </ol>
      )}

      {review.is_mine && hasTeamReply && onChange && (
        <form onSubmit={sendReply} className="mt-2 flex gap-2">
          <input
            aria-label="Reply to the Vatsa AI team"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={2000}
            placeholder="Reply to the Vatsa AI team…"
            className="flex-1 rounded-lg border border-border/60 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
          />
          <button type="submit" disabled={busy || reply.trim().length < 2} className={cn(ACTION, "border border-border/60")}>Reply</button>
        </form>
      )}

      {!readOnly && (
        <footer className="mt-3 flex flex-wrap items-center gap-1 text-muted-foreground">
          {signedIn ? (
            <>
              {!review.is_mine && (
                <>
                  <button type="button" disabled={busy} onClick={() => vote("helpful")} aria-pressed={review.my_vote === "helpful"} aria-label={`Helpful (${review.helpful_count})`} className={cn(ACTION, review.my_vote === "helpful" && "text-foreground")}>
                    <ThumbsUp className={cn("h-3.5 w-3.5", review.my_vote === "helpful" && "fill-current")} aria-hidden="true" /> {review.helpful_count}
                  </button>
                  <button type="button" disabled={busy} onClick={() => vote("not_helpful")} aria-pressed={review.my_vote === "not_helpful"} aria-label={`Not helpful (${review.not_helpful_count})`} className={cn(ACTION, review.my_vote === "not_helpful" && "text-foreground")}>
                    <ThumbsDown className={cn("h-3.5 w-3.5", review.my_vote === "not_helpful" && "fill-current")} aria-hidden="true" /> {review.not_helpful_count}
                  </button>
                </>
              )}
              <button type="button" onClick={togglePin} aria-pressed={review.pinned} className={ACTION}>
                {review.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
                {review.pinned ? "Unpin" : "Pin to wall"}
              </button>
              {!review.is_mine && (
                <button type="button" onClick={() => setReporting(true)} disabled={reported} className={cn(ACTION, "ml-auto")}>
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" /> {reported ? "Reported" : "Report"}
                </button>
              )}
            </>
          ) : (
            <span className="text-xs">
              {review.helpful_count} found this helpful · <Link href={loginHref} className="underline hover:text-foreground">Sign in</Link> to vote or pin
            </span>
          )}
        </footer>
      )}
      {footer}
      {reporting && (
        <ReportModal
          reviewId={review.id}
          open={reporting}
          onClose={() => setReporting(false)}
          onReported={() => {
            setReported(true);
            toast({ type: "success", message: "Thanks. A moderator will take a look." });
          }}
        />
      )}
    </article>
  );
}
