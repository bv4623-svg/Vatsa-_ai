"use client";

import { Sparkles } from "lucide-react";
import { useUpgrade } from "./UpgradeProvider";

interface SidebarUpgradeCardProps {
  collapsed?: boolean;
}

/** Persistent low-key nudge shown at the bottom of the chat/code sidebars
 * for free-tier users, above the account/logout footer. */
export function SidebarUpgradeCard({ collapsed = false }: SidebarUpgradeCardProps) {
  const { openUpgrade } = useUpgrade();

  const open = () =>
    openUpgrade({
      source: collapsed ? "sidebar_collapsed" : "sidebar",
      reason: "Unlock higher daily limits, Vision, Reasoning and Agents.",
    });

  if (collapsed) {
    return (
      <button
        onClick={open}
        aria-label="Upgrade to Pro"
        title="Upgrade to Pro"
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400 transition-colors hover:from-purple-500/30 hover:to-pink-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      onClick={open}
      className="mx-2 flex items-center gap-2.5 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/10 to-purple-500/10 px-3 py-2.5 text-left transition-colors hover:from-accent/15 hover:to-purple-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Sparkles className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">Upgrade to Pro</span>
        <span className="block truncate text-[11px] text-muted-foreground">Unlock more messages, Vision, Reasoning</span>
      </span>
    </button>
  );
}
