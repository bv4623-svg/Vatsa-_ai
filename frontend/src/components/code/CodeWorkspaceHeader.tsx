"use client";

import { Command as CommandIcon, Sun, Moon, Sparkles, Star, Crown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlan } from "@/data/plans";
import type { ThemeMode } from "@/types/code";

interface CodeWorkspaceHeaderProps {
  pathname: string | null;
  theme: ThemeMode;
  modKey: string;
  onNavigateChat: () => void;
  onNavigateCode: () => void;
  onOpenCommandPalette: () => void;
  onToggleTheme: () => void;
  tier?: "free" | "pro" | "business" | "ultra";
  onUpgradeClick?: () => void;
}

export function CodeWorkspaceHeader({
  pathname, theme, modKey,
  onNavigateChat, onNavigateCode, onOpenCommandPalette, onToggleTheme,
  tier = "free", onUpgradeClick,
}: CodeWorkspaceHeaderProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border/40 bg-background/40 px-4 backdrop-blur-sm">
      <div className="w-8" />
      <div className="flex items-center gap-2">
        <button
          onClick={onNavigateChat}
          className="rounded px-2 py-1 text-xs transition-all hover:bg-accent/10"
        >
          Chat
        </button>
        <button
          onClick={onNavigateCode}
          className={cn(
            "rounded px-2 py-1 text-xs transition-all",
            pathname === "/code"
              ? "bg-accent/20 text-foreground"
              : "text-muted-foreground/40 hover:bg-accent/10 hover:text-foreground"
          )}
        >
          Code
        </button>
      </div>
      <div className="flex items-center gap-2">
        {tier === "ultra" ? (
          <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/20 to-orange-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-400">
            <Crown className="h-3 w-3" /> Ultra
          </div>
        ) : tier === "business" ? (
          <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-400">
            <Building2 className="h-3 w-3" /> {getPlan("business")?.name ?? "Business"}
          </div>
        ) : tier === "pro" ? (
          <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2.5 py-1 text-[11px] font-medium text-purple-400">
            <Star className="h-3 w-3" /> Pro
          </div>
        ) : (
          <button
            onClick={onUpgradeClick}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-[11px] font-medium text-white hover:opacity-90"
          >
            <Sparkles className="h-3 w-3" /> Upgrade to Pro
          </button>
        )}
        <button
          onClick={onOpenCommandPalette}
          aria-label={`Command palette (${modKey}+K)`}
          className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
        >
          <CommandIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
