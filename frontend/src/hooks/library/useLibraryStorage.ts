"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getStorageUsage } from "@/lib/library-client";
import { createAsyncQueryStore, getInitialQueryState } from "./asyncResource";
import type { StorageUsage } from "@/types/library";

/** Real usage from the backend's SUM(size_bytes) query -- refetch() is
 * called after any mutation (upload, delete, generate) so the bar never
 * shows a stale number. */
export function useLibraryStorage() {
  // createAsyncQueryStore() is a pure constructor (closures + a plain
  // object, no side effects), so useMemo is the correct "build once per
  // component instance" tool here -- a ref would need reading
  // ref.current during render, which this codebase's lint config
  // disallows outright.
  const store = useMemo(() => createAsyncQueryStore<StorageUsage>(), []);

  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<StorageUsage>);

  const refetch = useCallback(() => store.run(getStorageUsage), [store]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { usage: state.data, loading: state.loading, error: state.error, refetch };
}
