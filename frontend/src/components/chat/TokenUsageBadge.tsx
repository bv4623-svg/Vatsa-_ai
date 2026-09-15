"use client";
import React from "react";
import { useTier } from "@/hooks/useTier";

type Props = { used: number; total?: number };

export function TokenUsageBadge({ used, total = 10_000 }: Props) {
  const { isFree } = useTier();
  const pct = Math.min(100, (used / total) * 100);

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-1.5 w-24 rounded bg-gray-200">
        <div
          className={`h-1.5 rounded ${pct > 80 ? "bg-red-500" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span>
        {used.toLocaleString()} / {total.toLocaleString()} tokens
        {isFree && " (Free)"}
      </span>
    </div>
  );
}
