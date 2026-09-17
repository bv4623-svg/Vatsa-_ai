"use client";

interface ScheduledPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  onGoToPage: (page: number) => void;
}

export function ScheduledPagination({ page, pageSize, total, hasMore, onGoToPage }: ScheduledPaginationProps) {
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onGoToPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-border px-2.5 py-1 hover:bg-accent/10 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={() => onGoToPage(page + 1)}
          disabled={!hasMore}
          className="rounded-lg border border-border px-2.5 py-1 hover:bg-accent/10 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
