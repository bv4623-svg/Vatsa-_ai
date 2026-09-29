"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-3.5 w-3.5", n <= value ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600")} aria-hidden="true" />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Star className={cn("h-6 w-6", n <= value ? "fill-amber-400 text-amber-400" : "text-zinc-400")} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
