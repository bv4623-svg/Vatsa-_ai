"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/session";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    clearSession();
    router.replace("/");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
      <p className="text-sm text-zinc-400">Signing you out…</p>
    </main>
  );
}
