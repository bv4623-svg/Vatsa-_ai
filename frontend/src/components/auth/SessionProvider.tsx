"use client";

import { useEffect } from "react";
import { bootstrapSession } from "@/lib/session";

/** Restores the signed-in user once per page load, before any route needs
 * it. Mounted in the root layout so /pricing, /, /checkout and every other
 * entry point see the same session as /home and /code. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void bootstrapSession();
  }, []);

  return <>{children}</>;
}
