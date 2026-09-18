"use client";

import Link from "next/link";
import { AIIcon } from "@/components/brand/AIIcon";

export function VatsaMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="focus-ring inline-flex items-center gap-2 rounded-lg"
      aria-label="Vatsa AI home"
    >
      <AIIcon size={28} />
      {!compact && (
        <span className="text-[17px] font-semibold tracking-[-.04em] text-gray-900 dark:text-white">
          vatsa<span className="text-gray-400 dark:text-gray-500">.ai</span>
        </span>
      )}
    </Link>
  );
}
