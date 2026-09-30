"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquareQuote } from "lucide-react";
import { useSignedIn } from "@/hooks/useSignedIn";

/** Same header as Scheduled Tasks / Feedback, so the new pages feel native. */
export function ReviewsLayout({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const signedIn = useSignedIn();
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-sm">
        <Link
          href={signedIn ? "/home" : "/"}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {signedIn ? "Back to chat" : "Home"}
        </Link>
        <div className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
        <h1 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquareQuote className="h-4 w-4" aria-hidden="true" /> {title}
        </h1>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">{children}</div>
    </main>
  );
}

export function ReviewSkeletons({ count = 6 }: { count?: number }) {
  const heights = [120, 170, 140, 190, 130, 160];
  return (
    <div role="status" aria-label="Loading reviews" className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="mb-4 animate-pulse break-inside-avoid rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70" style={{ height: heights[i % heights.length] }} />
      ))}
    </div>
  );
}

export function EmptyReviews({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-16 text-center">
      <MessageSquareQuote className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}
