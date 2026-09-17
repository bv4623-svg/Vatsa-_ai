"use client";

import Link from "next/link";
import Image from "next/image";

export function VatsaMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="focus-ring inline-flex items-center gap-2 rounded-lg"
      aria-label="Vatsa AI home"
    >
      <div className="relative h-7 w-7">
        <Image
          src="/logo.png"
          alt="Vatsa AI"
          fill
          className="object-contain"
          sizes="28px"
        />
      </div>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-[-.04em] text-gray-900 dark:text-white">
          vatsa<span className="text-gray-400 dark:text-gray-500">.ai</span>
        </span>
      )}
    </Link>
  );
}


