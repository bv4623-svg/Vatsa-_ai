"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listNotifications, markNotificationRead, markAllNotificationsRead, type NotificationsPage } from "@/lib/account-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";

const EMPTY: NotificationsPage = { items: [], unreadCount: 0 };

export function useNotifications() {
  const store = useMemo(() => createAsyncQueryStore<NotificationsPage>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<NotificationsPage>);
  const page = state.data ?? EMPTY;

  const refetch = useCallback(() => store.run(listNotifications), [store]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const markRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id);
      await refetch();
    },
    [refetch]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    await refetch();
  }, [refetch]);

  return {
    notifications: page.items,
    unreadCount: page.unreadCount,
    loading: state.loading,
    error: state.error,
    refetch,
    markRead,
    markAllRead,
  };
}
