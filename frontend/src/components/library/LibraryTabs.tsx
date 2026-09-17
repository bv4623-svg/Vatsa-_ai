"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS: { value: string | null; key: string }[] = [
  { value: null, key: "all" },
  { value: "chat", key: "chats" },
  { value: "document", key: "documents" },
  { value: "code", key: "code" },
  { value: "artifact", key: "artifacts" },
  { value: "upload", key: "uploads" },
  { value: "generated", key: "generated" },
];

interface LibraryTabsProps {
  active: string | null;
  onChange: (type: string | null) => void;
}

export function LibraryTabs({ active, onChange }: LibraryTabsProps) {
  const t = useTranslations("library.tabs");
  return (
    <div role="tablist" aria-label={t("filtersLabel")} className="flex flex-wrap gap-1">
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
          {t(tab.key)}
        </button>
      ))}
    </div>
  );
}
