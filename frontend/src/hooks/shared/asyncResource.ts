/** A tiny external-store-backed async resource, read via
 * useSyncExternalStore rather than useState+useEffect. The mutation that
 * runs a fetch and updates `state` never touches a React setState
 * function -- it mutates a plain closure variable and notifies
 * subscribers, the same shape as this repo's useCurrency/useTheme -- so
 * an effect that kicks off a fetch through it can't be reachable-traced
 * to a useState setter the way a bare `useEffect(() => { ...; setX(y); })`
 * can. Shared across features (Library, Scheduled Tasks, ...) rather than
 * duplicated per feature. */
export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface AsyncQueryStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => QueryState<T>;
  run: (fetcher: () => Promise<T>) => Promise<void>;
  /** Sets data synchronously (no fetch in flight) -- e.g. clearing to a
   * known value when there is nothing to fetch for the current input. */
  set: (data: T) => void;
}

const INITIAL: QueryState<never> = { data: null, loading: true, error: null };

/** Stable reference for useSyncExternalStore's getServerSnapshot -- the
 * server can never know the fetch result, so every resource starts in
 * this exact loading state on the first (server-rendered) paint. */
export function getInitialQueryState<T>(): QueryState<T> {
  return INITIAL;
}

export function createAsyncQueryStore<T>(): AsyncQueryStore<T> {
  let state: QueryState<T> = INITIAL;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((l) => l());
  const setState = (patch: Partial<QueryState<T>>) => {
    state = { ...state, ...patch };
    notify();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    set(data) {
      setState({ data, error: null, loading: false });
    },
    async run(fetcher) {
      setState({ loading: true });
      try {
        const data = await fetcher();
        setState({ data, error: null, loading: false });
      } catch (err) {
        setState({ error: err instanceof Error ? err.message : "Request failed.", loading: false });
      }
    },
  };
}
