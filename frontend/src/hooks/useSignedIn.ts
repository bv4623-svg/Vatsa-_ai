"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { getToken } from "@/lib/auth";

/** False on the server and during hydration, so signed-in-only UI never causes a hydration mismatch. */
export function useSignedIn(): boolean {
  const hydrated = useHydrated();
  return hydrated && Boolean(getToken());
}
