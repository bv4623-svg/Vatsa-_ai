"use client";

import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { PageFooter } from "./PageFooter";

/** Wraps a legal/info page's own content (hero, sections) with the shared
 * header and footer, plus the consistent width/padding all such pages use
 * (max-w-4xl, py-16 px-6 -- see Task 8 of the legal-pages-consistency PRD).
 * The page itself still owns its own background/particle effects, which
 * render behind this (they're position:fixed, so nesting doesn't matter). */
export function LegalPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader />
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-16">{children}</main>
      <PageFooter />
    </>
  );
}
