"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/account-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";
import type { ApiKey, ApiKeyCreated } from "@/types/account";

export function useApiKeys() {
  const store = useMemo(() => createAsyncQueryStore<ApiKey[]>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<ApiKey[]>);

  const refetch = useCallback(() => store.run(listApiKeys), [store]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(
    async (name: string): Promise<ApiKeyCreated> => {
      const created = await createApiKey(name);
      await refetch();
      return created;
    },
    [refetch]
  );

  const revoke = useCallback(
    async (id: string) => {
      await revokeApiKey(id);
      await refetch();
    },
    [refetch]
  );

  return { keys: state.data ?? [], loading: state.loading, error: state.error, refetch, create, revoke };
}
