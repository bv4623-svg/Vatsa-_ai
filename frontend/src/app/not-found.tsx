import type { Metadata } from "next";
import Link from "next/link";
import { AIIcon } from "@/components/brand/AIIcon";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <AIIcon size={56} />
      <p className="text-sm font-medium tracking-wide text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold text-foreground">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The link may be broken, or the page may have moved.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link href="/" className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
          Go to homepage
        </Link>
        <Link href="/home" className="rounded-lg border border-border/60 px-4 py-2 text-sm text-foreground hover:bg-accent/10">
          Open chat
        </Link>
      </div>
    </main>
  );
}
