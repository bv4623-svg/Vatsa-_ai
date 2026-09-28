"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

/** "just now" / "5m ago" / "3h ago", refreshed every minute; the full time is in the tooltip. */
export function RelativeTime({ date, className }: { date?: Date | string; className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} className={className} suppressHydrationWarning>
      {formatRelativeTime(d)}
    </time>
  );
}
