"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listAllChats, type ProjectPickerChat } from "@/lib/chat-projects-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";

/** All of the user's chats, real titles included -- used both to render
 * a project's current chats (resolving ChatProject.chatIds to titles) and
 * to power the "add chat" picker (chats not yet in this project). */
export function useProjectChatPicker() {
  const store = useMemo(() => createAsyncQueryStore<ProjectPickerChat[]>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<ProjectPickerChat[]>);

  const refetch = useCallback(() => store.run(listAllChats), [store]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { chats: state.data ?? [], loading: state.loading, error: state.error, refetch };
}
