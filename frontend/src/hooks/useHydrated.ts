import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** false during server render and hydration, true afterwards. Use it to
 * gate UI that depends on browser-only state (localStorage, window) without
 * a setState-in-effect "mounted" flag. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
