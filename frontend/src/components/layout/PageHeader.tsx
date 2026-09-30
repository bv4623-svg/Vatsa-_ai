"use client";

import { useState } from "react";
import Link from "next/link";
import { Command, Menu } from "lucide-react";
import { VatsaMark } from "./VatsaMark";
import { Magnetic } from "@/components/pricing/Magnetic";
import { useAppStore } from "@/stores/app-store";

/** Nav links set their own colour: the global `a` rule in globals.css
 * would otherwise turn every link that isn't the active one blue. */
const navLink = (isActive: boolean) =>
  isActive
    ? "text-gray-900 dark:text-white"
    : "text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white";

/** The one header used on every marketing/legal page (home, pricing,
 * privacy, terms, refund, return, disclaimer, about, contact). Not used on
 * /login, which has its own intentional split-screen layout with no nav. */
export function PageHeader({ active }: { active?: "home" | "pricing" }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const user = useAppStore((s) => s.user);
  const userTier = useAppStore((s) => s.userTier);
  const displayName = user?.name || user?.full_name || user?.email;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-background/80 backdrop-blur-sm dark:border-gray-800">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <VatsaMark />

        <nav aria-label="Main" className="hidden items-center gap-6 text-sm lg:flex">
          <Link href="/" aria-current={active === "home" ? "page" : undefined} className={`py-1 ${navLink(active === "home")}`}>
            Home
          </Link>
          <Link href="/pricing" aria-current={active === "pricing" ? "page" : undefined} className={`py-1 ${navLink(active === "pricing")}`}>
            Pricing
          </Link>
          <Link href="/home" className={`py-1 ${navLink(false)}`}>App</Link>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 sm:flex dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <Command size={13} aria-hidden="true" /> K
          </span>

          {isAuthenticated ? (
            <>
              <span className="hidden text-sm text-gray-600 sm:block dark:text-gray-300">{displayName}</span>
              <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium capitalize text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {userTier}
              </span>
              <Link href="/home" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                Open app
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:text-gray-900 sm:block dark:text-gray-400 dark:hover:text-white">
                Sign in
              </Link>
              <Magnetic strength={0.25}>
                <Link href="/signup" className="inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                  Start building
                </Link>
              </Magnetic>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
            className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:border-gray-300 lg:hidden dark:border-gray-800 dark:text-gray-400"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-gray-200 px-5 py-3 lg:hidden dark:border-gray-800">
          <div className="flex flex-col text-sm">
            <Link href="/" aria-current={active === "home" ? "page" : undefined} onClick={() => setMobileNavOpen(false)} className={`py-2.5 ${navLink(active === "home")}`}>Home</Link>
            <Link href="/pricing" aria-current={active === "pricing" ? "page" : undefined} onClick={() => setMobileNavOpen(false)} className={`py-2.5 ${navLink(active === "pricing")}`}>Pricing</Link>
            <Link href="/home" onClick={() => setMobileNavOpen(false)} className={`py-2.5 ${navLink(false)}`}>App</Link>
            {!isAuthenticated && <Link href="/login" onClick={() => setMobileNavOpen(false)} className={`py-2.5 ${navLink(false)}`}>Sign in</Link>}
          </div>
        </nav>
      )}
    </header>
  );
}
