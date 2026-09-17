"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listTasks } from "@/lib/scheduled-tasks-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";
import type { ScheduledTasksPage } from "@/types/scheduled-task";

const PAGE_SIZE = 20;
const EMPTY_PAGE: ScheduledTasksPage = { items: [], total: 0, page: 1, page_size: PAGE_SIZE, has_more: false };

export function useScheduledTasks() {
  const store = useMemo(() => createAsyncQueryStore<ScheduledTasksPage>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<ScheduledTasksPage>);
  const page = state.data ?? EMPTY_PAGE;

  const fetchPage = useCallback((targetPage: number) => listTasks({ page: targetPage, pageSize: PAGE_SIZE }), []);

  useEffect(() => {
    void store.run(() => fetchPage(1));
  }, [store, fetchPage]);

  const goToPage = useCallback(
    (targetPage: number) => {
      if (targetPage < 1) return;
      void store.run(() => fetchPage(targetPage));
    },
    [store, fetchPage]
  );

  const refetch = useCallback(() => store.run(() => fetchPage(page.page)), [store, fetchPage, page.page]);

  return {
    tasks: page.items,
    total: page.total,
    page: page.page,
    pageSize: page.page_size,
    hasMore: page.has_more,
    loading: state.loading,
    error: state.error,
    goToPage,
    refetch,
  };
}
