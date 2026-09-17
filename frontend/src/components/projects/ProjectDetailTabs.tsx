"use client";

import { cn } from "@/lib/utils";

export type ProjectTab = "chats" | "files" | "settings";

const TABS: { value: ProjectTab; label: string }[] = [
  { value: "chats", label: "Chats" },
  { value: "files", label: "Files" },
  { value: "settings", label: "Settings" },
];

interface ProjectDetailTabsProps {
  active: ProjectTab;
  onChange: (tab: ProjectTab) => void;
}

export function ProjectDetailTabs({ active, onChange }: ProjectDetailTabsProps) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-border/60 px-4">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === tab.value
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
