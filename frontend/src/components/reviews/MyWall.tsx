"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, GripVertical, PinOff } from "lucide-react";

import { ListStatus } from "@/components/ui/list-status";
import { useToast } from "@/components/ui/use-toast";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { EmptyReviews, ReviewSkeletons, ReviewsLayout } from "@/components/reviews/ReviewsLayout";
import {
  appealReview,
  deleteReview,
  fetchMyReviews,
  fetchMyWall,
  pinReview,
  reorderWall,
  unpinReview,
  type Review,
  type WallPinItem,
} from "@/services/reviews";

const SMALL = "flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-xs hover:bg-accent/10 disabled:opacity-40";

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function MyWall() {
  const { toast } = useToast();
  const [pins, setPins] = useState<WallPinItem[]>([]);
  const [mine, setMine] = useState<Review[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const [editing, setEditing] = useState<Review | null>(null);
  const [appealing, setAppealing] = useState<number | null>(null);
  const [appealText, setAppealText] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyWall(), fetchMyReviews()])
      .then(([wall, reviews]) => {
        if (cancelled) return;
        setPins(wall.items);
        setUserId(wall.user_id);
        setMine(reviews.items);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load your wall."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const saveOrder = async (next: WallPinItem[]) => {
    const previous = pins;
    setPins(next);
    try {
      await reorderWall(next.map((p) => p.review_id));
    } catch (err) {
      setPins(previous);
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't save the new order." });
    }
  };

  const setPublic = async (pin: WallPinItem, isPublic: boolean) => {
    setPins((prev) => prev.map((p) => (p.review_id === pin.review_id ? { ...p, is_public: isPublic } : p)));
    try {
      await pinReview(pin.review_id, isPublic);
    } catch (err) {
      setPins((prev) => prev.map((p) => (p.review_id === pin.review_id ? { ...p, is_public: !isPublic } : p)));
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't update that pin." });
    }
  };

  const unpin = async (pin: WallPinItem) => {
    const previous = pins;
    setPins((prev) => prev.filter((p) => p.review_id !== pin.review_id));
    try {
      await unpinReview(pin.review_id);
    } catch (err) {
      setPins(previous);
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't unpin it." });
    }
  };

  const remove = async (review: Review) => {
    if (!window.confirm("Delete this review? This can't be undone.")) return;
    try {
      await deleteReview(review.id);
      setMine((prev) => prev.filter((r) => r.id !== review.id));
      setPins((prev) => prev.filter((p) => p.review_id !== review.id));
      toast({ type: "success", message: "Review deleted." });
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't delete it." });
    }
  };

  const sendAppeal = async (review: Review) => {
    if (appealText.trim().length < 10) return;
    try {
      const updated = await appealReview(review.id, appealText.trim());
      setMine((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
      setAppealing(null);
      setAppealText("");
      toast({ type: "success", message: "Appeal sent. A moderator will look again." });
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't send the appeal." });
    }
  };

  const publicUrl = userId ? `/users/${userId}/wall` : null;
  const anyPublic = pins.some((p) => p.is_public);

  return (
    <ReviewsLayout
      title="My wall"
      actions={<Link href="/wall" className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent/10 hover:text-foreground">All reviews</Link>}
    >
      <ListStatus loading={false} error={error} count={pins.length + mine.length} onRetry={reload} />
      {loading && !error && <ReviewSkeletons count={3} />}

      {!loading && !error && (
        <>
          <section aria-labelledby="pins-heading" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="pins-heading" className="text-sm font-semibold text-foreground">Pinned reviews</h2>
              {publicUrl && anyPublic && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${publicUrl}`).then(
                    () => toast({ type: "success", message: "Link to your public wall copied." }),
                    () => toast({ type: "error", message: "Couldn't copy the link." }),
                  )}
                  className={SMALL}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy public wall link
                </button>
              )}
              {publicUrl && anyPublic && <Link href={publicUrl} className="text-xs underline text-muted-foreground">View public wall</Link>}
            </div>
            {pins.length === 0 ? (
              <EmptyReviews
                title="Nothing pinned yet"
                hint="Pin reviews you find useful from the reviews wall; they'll collect here."
                action={<Link href="/wall" className="mt-2 text-sm underline">Browse reviews</Link>}
              />
            ) : (
              <ol aria-label="Pinned reviews" className="space-y-3">
                {pins.map((pin, index) => (
                  <li
                    key={pin.review_id}
                    draggable
                    onDragStart={() => setDragging(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragging !== null && dragging !== index) saveOrder(move(pins, dragging, index));
                      setDragging(null);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={dragging === index ? "opacity-50" : undefined}
                  >
                    {pin.review ? (
                      <ReviewCard review={pin.review} signedIn readOnly footer={null} />
                    ) : (
                      <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">This review is no longer available.</p>
                    )}
                    <div className="-mt-2 mb-1 flex flex-wrap items-center gap-2 px-1">
                      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" aria-hidden="true" />
                      <button type="button" className={SMALL} disabled={index === 0} onClick={() => saveOrder(move(pins, index, index - 1))} aria-label="Move up">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" className={SMALL} disabled={index === pins.length - 1} onClick={() => saveOrder(move(pins, index, index + 1))} aria-label="Move down">
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" checked={pin.is_public} onChange={(e) => setPublic(pin, e.target.checked)} />
                        Show on my public wall
                      </label>
                      <button type="button" className={`${SMALL} ml-auto`} onClick={() => unpin(pin)}>
                        <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> Unpin
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="mine-heading" className="space-y-3">
            <h2 id="mine-heading" className="text-sm font-semibold text-foreground">Your reviews</h2>
            {mine.length === 0 ? (
              <EmptyReviews title="You haven't written a review yet" action={<Link href="/wall" className="mt-2 text-sm underline">Write one</Link>} />
            ) : (
              <div className="columns-1 gap-4 md:columns-2">
                {mine.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    signedIn
                    readOnly
                    onChange={(updated) => setMine((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
                    footer={
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(review.status === "approved" || review.status === "pending") && (
                          <button type="button" className={SMALL} onClick={() => setEditing(review)}>Edit</button>
                        )}
                        {(review.status === "rejected" || review.status === "hidden") && !review.appealed && (
                          <button type="button" className={SMALL} onClick={() => setAppealing(review.id)}>Appeal</button>
                        )}
                        <button type="button" className={SMALL} onClick={() => remove(review)}>Delete</button>
                        {appealing === review.id && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              sendAppeal(review);
                            }}
                            className="flex w-full gap-2"
                          >
                            <input
                              aria-label="Why should this review be published?"
                              value={appealText}
                              onChange={(e) => setAppealText(e.target.value)}
                              maxLength={1000}
                              placeholder="Why should this review be published?"
                              className="flex-1 rounded-lg border border-border/60 bg-transparent px-2.5 py-1.5 text-xs outline-none"
                            />
                            <button type="submit" className={SMALL} disabled={appealText.trim().length < 10}>Send appeal</button>
                          </form>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {editing && (
        <ReviewForm
          open
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setMine((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
            if (saved.status !== "rejected") toast({ type: "success", message: saved.status === "approved" ? "Review updated." : "Saved. It'll be checked before it shows again." });
          }}
        />
      )}
    </ReviewsLayout>
  );
}
