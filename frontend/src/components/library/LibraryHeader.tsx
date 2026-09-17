"use client";

import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";

export function LibraryHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur-sm">
      <Link
        href="/home"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to chat
      </Link>
      <div className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
      <h1 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FolderOpen className="h-4 w-4" aria-hidden="true" /> Library
      </h1>
    </header>
  );
}
