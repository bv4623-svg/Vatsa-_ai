"use client";

import { cn } from "@/lib/utils";

const TABS: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "chat", label: "Chats" },
  { value: "document", label: "Documents" },
  { value: "code", label: "Code" },
  { value: "artifact", label: "Artifacts" },
  { value: "upload", label: "Uploads" },
  { value: "generated", label: "Generated" },
];

interface LibraryTabsProps {
  active: string | null;
  onChange: (type: string | null) => void;
}

export function LibraryTabs({ active, onChange }: LibraryTabsProps) {
  return (
    <div role="tablist" aria-label="Library filters" className="flex flex-wrap gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.value ?? "all"}
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            active === tab.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
