"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format-bytes";
import { useUpgrade } from "@/components/billing/UpgradeProvider";
import type { StorageUsage } from "@/types/library";

const TYPE_LABELS: Record<string, string> = {
  chat: "Chats",
  document: "Documents",
  code: "Code",
  artifact: "Artifacts",
  upload: "Uploads",
  generated: "Generated",
};

interface LibraryStorageBarProps {
  usage: StorageUsage | null;
  loading: boolean;
}

/** Every number here is read straight from GET /api/library/storage --
 * a real SUM(size_bytes) query, never a hardcoded placeholder. */
export function LibraryStorageBar({ usage, loading }: LibraryStorageBarProps) {
  const { openUpgrade } = useUpgrade();

  if (loading || !usage) {
    return <div className="h-16 w-full animate-pulse rounded-xl bg-accent/5" aria-hidden="true" />;
  }

  const barColor = usage.at_limit ? "bg-red-500" : usage.at_warning ? "bg-amber-500" : "bg-accent";

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {formatBytes(usage.used_bytes)} of {formatBytes(usage.limit_bytes)} used
        </span>
        <span className="text-muted-foreground">{usage.percent}%</span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={usage.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(usage.percent, 100)}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {Object.entries(usage.breakdown)
          .filter(([, bytes]) => bytes > 0)
          .map(([type, bytes]) => (
            <span key={type}>
              {TYPE_LABELS[type] ?? type}: {formatBytes(bytes)}
            </span>
          ))}
      </div>

      {(usage.at_warning || usage.at_limit) && (
        <div
          className={cn(
            "mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
            usage.at_limit ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            {usage.at_limit
              ? "You're out of storage. Uploads and generated images are blocked until you free up space or upgrade."
              : "You're close to your storage limit."}
          </span>
          <button
            onClick={() =>
              openUpgrade({
                source: "quota_banner",
                // limitInfo renders as "used X of Y today", built for daily
                // message counts -- storage is GB, not a daily count, so
                // that context goes in the reason text instead.
                reason: `You're using ${formatBytes(usage.used_bytes)} of ${formatBytes(usage.limit_bytes)}. Upgrade for more storage.`,
              })
            }
            className="shrink-0 font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  );
}
