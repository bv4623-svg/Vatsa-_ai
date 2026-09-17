"use client";

import { useTranslations } from "next-intl";

export function LibraryLoadMore({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  const t = useTranslations("library.loadMore");
  if (!hasMore) return null;
  return (
    <div className="flex justify-center py-4">
      <button onClick={onClick} disabled={loading} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent/10 disabled:opacity-50">
        {loading ? t("loading") : t("loadMore")}
      </button>
    </div>
  );
}
