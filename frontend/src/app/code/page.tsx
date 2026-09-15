"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import Background from "@/components/landing/Background";
import { CodeWorkspace } from "@/components/code/CodeWorkspace";
import { useAuthStore, useAuthLoading, useIsAuthenticated } from "@/stores/auth";

const CodePage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isLoading = useAuthLoading();
  const isAuthenticated = useIsAuthenticated();
  const hydrate = useAuthStore((s) => s.hydrate);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-accent" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <Background />
      <main className="relative z-10 min-h-screen" suppressHydrationWarning>
        <CodeWorkspace />
      </main>
    </>
  );
};

export default CodePage;
