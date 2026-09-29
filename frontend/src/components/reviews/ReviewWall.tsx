"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PenLine, Pin, Search } from "lucide-react";

import { ListStatus } from "@/components/ui/list-status";
import { useToast } from "@/components/ui/use-toast";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { AISummaryCard, ReviewStats } from "@/components/reviews/ReviewInsights";
import { EmptyReviews, ReviewSkeletons, ReviewsLayout } from "@/components/reviews/ReviewsLayout";
import { useSignedIn } from "@/hooks/useSignedIn";
import {
  REVIEW_TAGS,
  TAG_LABELS,
  fetchSummary,
  fetchWall,
  type Review,
  type ReviewFilters,
  type ReviewSort,
  type ReviewStats as Stats,
  type ReviewSummary,
  type ReviewTag,
} from "@/services/reviews";

const SELECT = "rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground";

export function ReviewWall() {
  const signedIn = useSignedIn();
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReviewFilters>({ sort: "recent" });
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Review[]>([]);
  const [featured, setFeatured] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [writing, setWriting] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWall(filters)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setFeatured(page.featured ?? []);
        setStats(page.stats ?? null);
        setCursor(page.next_cursor);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load reviews."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    fetchSummary().then((s) => !cancelled && setSummary(s)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const applyFilters = (patch: Partial<ReviewFilters>) => {
    setLoading(true);
    setError(null);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchWall(filters, cursor);
      setItems((prev) => [...prev, ...page.items.filter((r) => !prev.some((p) => p.id === r.id))]);
      setCursor(page.next_cursor);
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "Couldn't load more reviews." });
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, filters, loadingMore, toast]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const replace = (updated: Review) => {
    setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setFeatured((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const onSaved = (review: Review) => {
    if (review.status === "approved") {
      toast({ type: "success", message: review.is_public ? "Your review is live. Thank you!" : "Saved. It's private, so only you can see it." });
      reload();
    } else if (review.status === "pending") {
      toast({ type: "info", message: "Thanks! Your review will appear once it's been checked." });
    }
  };

  const filtered = Boolean(filters.rating || filters.tag || filters.verified || filters.days || filters.q);
  const showFeatured = featured.length > 0 && !filtered;
  // Featured reviews are shown once, in their own section, not again in the grid.
  const gridItems = showFeatured ? items.filter((r) => !featured.some((f) => f.id === r.id)) : items;

  return (
    <ReviewsLayout
      title="Reviews"
      actions={
        <>
          {signedIn && (
            <Link href="/wall/me" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent/10 hover:text-foreground">
              <Pin className="h-4 w-4" aria-hidden="true" /> My wall
            </Link>
          )}
          {signedIn ? (
            <button type="button" onClick={() => setWriting(true)} className="flex items-center gap-1.5 rounded-lg bg-accent-solid px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90">
              <PenLine className="h-4 w-4" aria-hidden="true" /> Write a review
            </button>
          ) : (
            <Link href="/login?redirect=%2Fwall" className="flex items-center gap-1.5 rounded-lg bg-accent-solid px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90">
              <PenLine className="h-4 w-4" aria-hidden="true" /> Sign in to review
            </Link>
          )}
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {stats ? <ReviewStats stats={stats} selected={filters.rating} onSelect={(rating) => applyFilters({ rating })} /> : <div />}
        {summary && <AISummaryCard summary={summary} />}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="search">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({ q: search });
          }}
          className="flex min-w-[200px] flex-1 items-center gap-1 rounded-lg border border-border/60 px-2"
        >
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input aria-label="Search reviews" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reviews" maxLength={100} className="w-full bg-transparent py-1.5 text-sm outline-none" />
        </form>
        <label className="sr-only" htmlFor="reviews-tag">Topic</label>
        <select id="reviews-tag" value={filters.tag ?? ""} onChange={(e) => applyFilters({ tag: e.target.value as ReviewTag | "" })} className={SELECT}>
          <option value="">All topics</option>
          {REVIEW_TAGS.map((t) => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}
        </select>
        <label className="sr-only" htmlFor="reviews-days">Date</label>
        <select id="reviews-days" value={filters.days ?? ""} onChange={(e) => applyFilters({ days: e.target.value ? Number(e.target.value) : undefined })} className={SELECT}>
          <option value="">Any time</option>
          <option value="7">Past week</option>
          <option value="30">Past month</option>
          <option value="365">Past year</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={Boolean(filters.verified)} onChange={(e) => applyFilters({ verified: e.target.checked || undefined })} />
          Verified only
        </label>
        <label className="sr-only" htmlFor="reviews-sort">Sort</label>
        <select id="reviews-sort" value={filters.sort} onChange={(e) => applyFilters({ sort: e.target.value as ReviewSort })} className={SELECT}>
          <option value="recent">Most recent</option>
          <option value="top">Highest rated</option>
          <option value="helpful">Most helpful</option>
        </select>
      </div>

      {showFeatured && (
        <section aria-label="Featured reviews">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Featured</h2>
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {featured.map((r) => <ReviewCard key={`f-${r.id}`} review={r} signedIn={signedIn} onChange={replace} />)}
          </div>
        </section>
      )}

      <ListStatus loading={false} error={error} count={items.length} onRetry={reload} />
      {loading && items.length === 0 && !error && <ReviewSkeletons />}
      {!loading && !error && items.length === 0 && (
        <EmptyReviews
          title={filtered ? "No reviews match these filters" : "No reviews yet"}
          hint={filtered ? "Try removing a filter." : "Be the first to share how Vatsa AI works for you."}
          action={
            filtered ? (
              <button type="button" onClick={() => { setSearch(""); applyFilters({ rating: undefined, tag: "", verified: undefined, days: undefined, q: "" }); }} className="mt-2 text-sm underline">
                Clear filters
              </button>
            ) : null
          }
        />
      )}

      <section aria-label="All reviews" aria-busy={loading} className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {gridItems.map((r) => <ReviewCard key={r.id} review={r} signedIn={signedIn} onChange={replace} />)}
      </section>

      {cursor && (
        <div ref={sentinel} className="flex justify-center py-4">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-lg border border-border/60 px-4 py-2 text-sm hover:bg-accent/10 disabled:opacity-50">
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {writing && <ReviewForm open={writing} onClose={() => setWriting(false)} onSaved={onSaved} />}
    </ReviewsLayout>
  );
}
