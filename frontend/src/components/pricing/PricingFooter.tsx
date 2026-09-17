"use client";

import Link from "next/link";
import { VatsaMark } from "./VatsaMark";
import { FOOTER_LINKS } from "@/data/plans";

export function PricingFooter() {
  return (
    <footer className="border-t border-gray-200 py-10 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <VatsaMark compact />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © 2026 Vatsa AI. Intelligence, orchestrated.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="footer-link">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
