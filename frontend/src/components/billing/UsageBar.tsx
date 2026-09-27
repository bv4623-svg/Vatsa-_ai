"use client";

import { useUpgrade } from "./UpgradeProvider";

interface UsageBarProps {
  usage?: Record<string, { used: number; limit: number }>;
}

/** Compact "3 images left · 2 searches left" strip shown to free users
 * only, right below the header. Chat is unlimited on every tier now, so
 * it never appears here -- a metric with limit === 0 means "unlimited"
 * (the backend's convention, see Backend/app/services/feature_access.py),
 * not "zero allowed", and is skipped entirely rather than shown as 0. */
export function UsageBar({ usage }: UsageBarProps) {
  const { openUpgrade } = useUpgrade();
  if (!usage) return null;

  const image = usage.image_gen;
  const search = usage.web_search;

  const metrics = [
    { key: "images", data: image },
    { key: "searches", data: search },
  ].filter((m): m is { key: string; data: { used: number; limit: number } } => !!m.data && m.data.limit > 0);

  if (metrics.length === 0) return null;

  const parts = metrics.map((m) => `${Math.max(0, m.data.limit - m.data.used)} ${m.key} left`);
  const isLow = metrics.some((m) => m.data.limit - m.data.used <= Math.ceil(m.data.limit * 0.2));
  const tightest = metrics.reduce((a, b) => (a.data.limit - a.data.used <= b.data.limit - b.data.used ? a : b));

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/30 bg-background/30 px-4 py-1.5 text-[11px] text-muted-foreground">
      <span className={isLow ? "text-amber-500" : ""}>{parts.join(" · ")}</span>
      <button
        onClick={() =>
          openUpgrade({
            source: "quota_banner",
            reason: `You have used ${tightest.data.used} of ${tightest.data.limit} ${tightest.key} today.`,
            limitInfo: { used: tightest.data.used, limit: tightest.data.limit },
          })
        }
        className="flex-shrink-0 font-medium text-accent hover:underline"
      >
        Upgrade →
      </button>
    </div>
  );
}
