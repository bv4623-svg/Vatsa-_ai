"use client";

import { Command as CommandIcon, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/types/code";

interface CodeWorkspaceHeaderProps {
  pathname: string | null;
  theme: ThemeMode;
  modKey: string;
  onNavigateChat: () => void;
  onNavigateCode: () => void;
  onOpenCommandPalette: () => void;
  onToggleTheme: () => void;
}

export function CodeWorkspaceHeader({
  pathname, theme, modKey,
  onNavigateChat, onNavigateCode, onOpenCommandPalette, onToggleTheme,
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
      <div className="flex items-center gap-1">
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
