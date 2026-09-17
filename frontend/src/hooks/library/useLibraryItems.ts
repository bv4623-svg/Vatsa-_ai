"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listItems } from "@/lib/library-client";
import { createAsyncQueryStore, getInitialQueryState } from "./asyncResource";
import type { LibraryItem, LibraryItemsPage, LibrarySortKey, SortOrder } from "@/types/library";

export interface LibraryFilters {
  type: string | null;
  parentId: string | null;
  search: string;
  sort: LibrarySortKey;
  order: SortOrder;
}

export const DEFAULT_FILTERS: LibraryFilters = {
  type: null,
  parentId: "",
  search: "",
  sort: "date",
  order: "desc",
};

const PAGE_SIZE = 50;
const EMPTY_PAGE: LibraryItemsPage = { items: [], total: 0, page: 1, page_size: PAGE_SIZE, has_more: false };

export function useLibraryItems(filters: LibraryFilters) {
  // One store per hook instance (see useLibraryStorage for why useMemo,
  // not useRef, is what builds it).
  const store = useMemo(() => createAsyncQueryStore<LibraryItemsPage>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<LibraryItemsPage>);
  const page = state.data ?? EMPTY_PAGE;

  const fetchPage = useCallback(
    (targetPage: number, append: LibraryItem[]) =>
      listItems({
        type: filters.type ?? undefined,
        parentId: filters.parentId,
        search: filters.search || undefined,
        sort: filters.sort,
        order: filters.order,
        page: targetPage,
        pageSize: PAGE_SIZE,
      }).then((data) => ({ ...data, items: [...append, ...data.items] })),
    [filters.type, filters.parentId, filters.search, filters.sort, filters.order]
  );

  // Filters changing means a fresh search: always page 1, replacing
  // whatever was loaded before.
  useEffect(() => {
    void store.run(() => fetchPage(1, []));
  }, [store, fetchPage]);

  const loadMore = useCallback(() => {
    if (!state.loading && page.has_more) {
      void store.run(() => fetchPage(page.page + 1, page.items));
    }
  }, [store, fetchPage, state.loading, page.has_more, page.page, page.items]);

  const refetch = useCallback(() => store.run(() => fetchPage(1, [])), [store, fetchPage]);

  return {
    items: page.items,
    total: page.total,
    hasMore: page.has_more,
    loading: state.loading,
    error: state.error,
    loadMore,
    refetch,
  };
}
