"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSession, API_BASE } from "@/lib/session";
import { getToken } from "@/lib/auth";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Best-effort: the token is the actual auth authority (see
    // session.ts), so the browser is fully logged out the moment
    // clearSession() runs below, regardless of whether this call
    // succeeds. It exists for API parity with POST /api/auth/logout, not
    // because the frontend depends on its response.
    const token = getToken();
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearSession();
    router.replace("/");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
      <p className="text-sm text-zinc-400">Signing you out…</p>
    </main>
  );
}
