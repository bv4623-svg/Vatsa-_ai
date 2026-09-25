"use client";

import Image from "next/image";
import Link from "next/link";

interface VatsaMarkProps {
  compact?: boolean;
  className?: string;
}

/** The single canonical brand mark for every page outside the legacy
 * pricing-specific components: logo.png (the real brand logo), not the
 * AIIcon placeholder some older pages still render. */
export function VatsaMark({ compact = false, className = "" }: VatsaMarkProps) {
  return (
    <Link
      href="/"
      className={`focus-ring inline-flex items-center gap-2 rounded-lg ${className}`}
      aria-label="Vatsa AI home"
    >
      <div className="relative h-7 w-7 shrink-0">
        <Image src="/logo.png" alt="Vatsa AI" fill className="object-contain" sizes="28px" priority />
      </div>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-[-.04em] text-gray-900 dark:text-white">
          vatsa<span className="text-gray-400 dark:text-gray-500">.ai</span>
        </span>
      )}
    </Link>
  );
}
