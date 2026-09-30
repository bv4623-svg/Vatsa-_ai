"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { AIIcon } from "@/components/brand/AIIcon";

/** Catches rendering errors below the root layout, so one broken component can't blank the whole app. */
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <AIIcon size={56} />
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">This page hit an unexpected error. Trying again usually fixes it.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="flex items-center gap-1.5 rounded-lg bg-accent-solid px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
        <Link href="/home" className="rounded-lg border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-accent/10">
          Back to chat
        </Link>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground/70">Reference: {error.digest}</p>}
    </main>
  );
}
