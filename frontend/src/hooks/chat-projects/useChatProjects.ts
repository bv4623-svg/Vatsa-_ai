"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listProjects } from "@/lib/chat-projects-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";
import type { ChatProject } from "@/types/chat-project";

export function useChatProjects() {
  const store = useMemo(() => createAsyncQueryStore<ChatProject[]>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<ChatProject[]>);

  const refetch = useCallback(() => store.run(() => listProjects()), [store]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { projects: state.data ?? [], loading: state.loading, error: state.error, refetch };
}
