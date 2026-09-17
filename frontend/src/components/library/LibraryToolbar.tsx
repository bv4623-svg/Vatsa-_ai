"use client";

import { useTranslations } from "next-intl";
import { FolderPlus, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibrarySortKey, LibraryViewMode, SortOrder } from "@/types/library";

interface LibraryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: LibrarySortKey;
  order: SortOrder;
  onSortChange: (sort: LibrarySortKey, order: SortOrder) => void;
  view: LibraryViewMode;
  onViewChange: (view: LibraryViewMode) => void;
  onCreateFolder: () => void;
}

const SORT_OPTIONS: { value: `${LibrarySortKey}-${SortOrder}`; key: string }[] = [
  { value: "date-desc", key: "dateDesc" },
  { value: "date-asc", key: "dateAsc" },
  { value: "name-asc", key: "nameAsc" },
  { value: "name-desc", key: "nameDesc" },
  { value: "size-desc", key: "sizeDesc" },
  { value: "size-asc", key: "sizeAsc" },
];

export function LibraryToolbar({ search, onSearchChange, sort, order, onSortChange, view, onViewChange, onCreateFolder }: LibraryToolbarProps) {
  const t = useTranslations("library.toolbar");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          className="w-full rounded-lg border border-border bg-input/10 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
        />
      </div>

      <select
        value={`${sort}-${order}`}
        onChange={(e) => {
          const [nextSort, nextOrder] = e.target.value.split("-") as [LibrarySortKey, SortOrder];
          onSortChange(nextSort, nextOrder);
        }}
        aria-label={t("sortLabel")}
        className="rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{t(`sort.${opt.key}`)}</option>
        ))}
      </select>

      <div role="group" aria-label={t("viewModeLabel")} className="flex rounded-lg border border-border p-0.5">
        <button
          onClick={() => onViewChange("grid")}
          aria-pressed={view === "grid"}
          aria-label={t("gridView")}
          className={cn("rounded-md p-1.5", view === "grid" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewChange("list")}
          aria-pressed={view === "list"}
          aria-label={t("listView")}
          className={cn("rounded-md p-1.5", view === "list" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <ListIcon className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={onCreateFolder}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <FolderPlus className="h-4 w-4" aria-hidden="true" /> {t("newFolder")}
      </button>
    </div>
  );
}
