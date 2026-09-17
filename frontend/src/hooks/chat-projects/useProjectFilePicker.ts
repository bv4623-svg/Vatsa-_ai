"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listItems } from "@/lib/library-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";
import type { LibraryItem } from "@/types/library";

/** All of the user's non-folder Library items -- used to power the "add
 * file" picker and to resolve ChatProject.fileIds to real names. */
export function useProjectFilePicker() {
  const store = useMemo(() => createAsyncQueryStore<LibraryItem[]>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<LibraryItem[]>);

  const refetch = useCallback(
    () =>
      store.run(async () => {
        const page = await listItems({ sort: "date", order: "desc", pageSize: 200 });
        return page.items.filter((i) => !i.isFolder);
      }),
    [store]
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { files: state.data ?? [], loading: state.loading, error: state.error, refetch };
}
