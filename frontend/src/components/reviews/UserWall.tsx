"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { ListStatus } from "@/components/ui/list-status";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { EmptyReviews, ReviewSkeletons, ReviewsLayout } from "@/components/reviews/ReviewsLayout";
import { useSignedIn } from "@/hooks/useSignedIn";
import { fetchUserWall, type Review } from "@/services/reviews";

export function UserWall({ userId }: { userId: number }) {
  const signedIn = useSignedIn();
  const [name, setName] = useState<string | null>(null);
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchUserWall(userId)
      .then((wall) => {
        if (cancelled) return;
        setName(wall.user.name);
        setItems(wall.items);
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as { status?: number }).status === 404) setNotFound(true);
        else setError(err instanceof Error ? err.message : "Couldn't load this wall.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <ReviewsLayout title={name ? `${name}'s wall` : "Wall"} actions={<Link href="/wall" className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent/10 hover:text-foreground">All reviews</Link>}>
      <ListStatus loading={false} error={error} count={items.length} onRetry={reload} />
      {loading && !error && <ReviewSkeletons count={3} />}
      {notFound && (
        <EmptyReviews
          title="This wall doesn't exist"
          hint="Its owner may not have shared any pinned reviews yet."
          action={<Link href="/wall" className="mt-2 text-sm underline">Browse reviews</Link>}
        />
      )}
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {items.map((r) => (
          <ReviewCard key={r.id} review={r} signedIn={signedIn} onChange={(u) => setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)))} />
        ))}
      </div>
    </ReviewsLayout>
  );
}
