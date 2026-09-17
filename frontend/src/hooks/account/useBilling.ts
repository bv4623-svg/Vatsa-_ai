"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getBillingSummary } from "@/lib/account-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";
import type { BillingSummary } from "@/types/account";

export function useBilling() {
  const store = useMemo(() => createAsyncQueryStore<BillingSummary>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<BillingSummary>);

  const refetch = useCallback(() => store.run(getBillingSummary), [store]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { billing: state.data, loading: state.loading, error: state.error, refetch };
}
