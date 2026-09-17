"use client";

import { useCallback, useMemo, useState } from "react";
import { downloadItem } from "@/lib/library-client";
import { useLibraryItems, DEFAULT_FILTERS } from "./useLibraryItems";
import { useLibraryStorage } from "./useLibraryStorage";
import { useLibrarySelection } from "./useLibrarySelection";
import { useLibraryModals } from "./useLibraryModals";
import type { FolderCrumb } from "@/components/library/LibraryBreadcrumb";
import type { LibraryItem, LibraryViewMode } from "@/types/library";

export function useLibraryPage() {
  const [activeType, setActiveType] = useState<string | null>(DEFAULT_FILTERS.type);
  const [folderPath, setFolderPath] = useState<FolderCrumb[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(DEFAULT_FILTERS.sort);
  const [order, setOrder] = useState(DEFAULT_FILTERS.order);
  const [view, setView] = useState<LibraryViewMode>("grid");
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);

  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : "";
  const filters = useMemo(
    () => ({ type: activeType, parentId: currentFolderId, search, sort, order }),
    [activeType, currentFolderId, search, sort, order]
  );

  const { items, hasMore, loading, error, loadMore, refetch } = useLibraryItems(filters);
  // Resolved against the live list rather than the object captured at
  // click time, so a rename/delete elsewhere (refetch) is reflected here
  // too instead of showing a stale name or a since-deleted item.
  const resolvedPreviewItem = useMemo(
    () => (previewItem ? (items.find((i) => i.id === previewItem.id) ?? null) : null),
    [previewItem, items]
  );
  const storage = useLibraryStorage();
  const selection = useLibrarySelection(useMemo(() => items.map((i) => i.id), [items]));
  const modals = useLibraryModals({
    currentFolderId,
    refetch,
    refetchStorage: storage.refetch,
    clearSelection: selection.clear,
  });

  const openItem = useCallback((item: LibraryItem) => {
    if (item.isFolder) {
      setFolderPath((prev) => [...prev, { id: item.id, name: item.name }]);
      setPreviewItem(null);
    } else {
      setPreviewItem(item);
    }
  }, []);

  const navigateBreadcrumb = useCallback((index: number) => {
    setFolderPath((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
    setPreviewItem(null);
  }, []);

  const handleBulkDownload = useCallback(async () => {
    const targets = items.filter((i) => selection.selected.has(i.id) && !i.isFolder);
    for (const item of targets) {
      await downloadItem(item.id, item.name);
    }
  }, [items, selection.selected]);

  const setSortOrder = useCallback((nextSort: typeof sort, nextOrder: typeof order) => {
    setSort(nextSort);
    setOrder(nextOrder);
  }, []);

  return {
    filters: { activeType, setActiveType, search, setSearch, sort, order, setSort: setSortOrder },
    view, setView,
    folderPath, navigateBreadcrumb, openItem,
    items, hasMore, loading, error, loadMore, refetch,
    storage,
    selection,
    previewItem: resolvedPreviewItem, setPreviewItem,
    handleBulkDownload,
    ...modals,
  };
}
