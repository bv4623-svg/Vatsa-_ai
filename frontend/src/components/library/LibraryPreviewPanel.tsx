"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { getItemPreview, type ItemPreview } from "@/lib/library-client";
import { formatBytes } from "@/lib/format-bytes";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/library/asyncResource";
import { LibraryPreviewBody } from "./LibraryPreviewBody";
import type { LibraryItem } from "@/types/library";

interface LibraryPreviewPanelProps {
  item: LibraryItem | null;
  onClose: () => void;
}

/** Real content, fetched from GET /api/library/items/{id}/preview -- never
 * a placeholder "preview not available" for something that has content. */
export function LibraryPreviewPanel({ item, onClose }: LibraryPreviewPanelProps) {
  const t = useTranslations("library.previewPanel");
  const store = useMemo(() => createAsyncQueryStore<ItemPreview | null>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<ItemPreview | null>);

  useEffect(() => {
    if (!item || item.isFolder) {
      store.set(null);
      return;
    }
    void store.run(() => getItemPreview(item.id));
  }, [item, store]);

  if (!item || item.isFolder) return null;

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-background sm:w-80" aria-label={t("label")}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="truncate text-sm font-medium text-foreground" title={item.name}>{item.name}</h2>
        <button onClick={onClose} aria-label={t("close")} className="rounded-md p-1 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {state.loading && <div className="h-32 animate-pulse rounded-lg bg-accent/5" />}
        {state.error && <p className="text-sm text-red-500">{state.error}</p>}
        {!state.loading && !state.error && state.data && <LibraryPreviewBody preview={state.data} />}
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {formatBytes(item.sizeBytes)} · {t("updated", { date: new Date(item.updatedAt).toLocaleString() })}
      </div>
    </aside>
  );
}
