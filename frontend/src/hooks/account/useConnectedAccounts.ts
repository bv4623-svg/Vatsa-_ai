"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listConnections, startConnectionLink, unlinkConnection } from "@/lib/account-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";
import type { ConnectedAccount, ConnectionProvider } from "@/types/account";

export function useConnectedAccounts() {
  const store = useMemo(() => createAsyncQueryStore<ConnectedAccount[]>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<ConnectedAccount[]>);

  const refetch = useCallback(() => store.run(listConnections), [store]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const startLink = useCallback(async (provider: ConnectionProvider) => {
    const url = await startConnectionLink(provider);
    window.location.assign(url);
  }, []);

  const unlink = useCallback(
    async (provider: ConnectionProvider) => {
      await unlinkConnection(provider);
      await refetch();
    },
    [refetch]
  );

  return { connections: state.data ?? [], loading: state.loading, error: state.error, refetch, startLink, unlink };
}
