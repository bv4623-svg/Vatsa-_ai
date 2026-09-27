"use client";

import { Loader2, RotateCw } from "lucide-react";

interface ListStatusProps {
  loading: boolean;
  error: string | null | undefined;
  /** Items currently shown; the spinner only covers a list with nothing in it. */
  count: number;
  onRetry: () => void;
  loadingLabel?: string;
}

/** Loading and failure states for a list page. Callers render their empty
 * state only when `showsEmpty(...)` is true, so "nothing here yet" never
 * appears while loading or next to an error (it would read as data loss). */
export function ListStatus({ loading, error, count, onRetry, loadingLabel = "Loading…" }: ListStatusProps) {
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
        <span className="flex-1">{error}</span>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="tap-target flex items-center gap-1.5 rounded-lg border border-current/30 px-2.5 py-1 text-xs font-medium hover:bg-red-500/10 disabled:opacity-50"
        >
          <RotateCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }
  if (loading && count === 0) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {loadingLabel}
      </div>
    );
  }
  return null;
}

export function showsEmpty({ loading, error, count }: Pick<ListStatusProps, "loading" | "error" | "count">): boolean {
  return !loading && !error && count === 0;
}
