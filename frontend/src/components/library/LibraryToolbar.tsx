"use client";

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

const SORT_OPTIONS: { value: `${LibrarySortKey}-${SortOrder}`; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "size-desc", label: "Largest first" },
  { value: "size-asc", label: "Smallest first" },
];

export function LibraryToolbar({ search, onSearchChange, sort, order, onSortChange, view, onViewChange, onCreateFolder }: LibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search library..."
          aria-label="Search library"
          className="w-full rounded-lg border border-border bg-input/10 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
        />
      </div>

      <select
        value={`${sort}-${order}`}
        onChange={(e) => {
          const [nextSort, nextOrder] = e.target.value.split("-") as [LibrarySortKey, SortOrder];
          onSortChange(nextSort, nextOrder);
        }}
        aria-label="Sort library items"
        className="rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <div role="group" aria-label="View mode" className="flex rounded-lg border border-border p-0.5">
        <button
          onClick={() => onViewChange("grid")}
          aria-pressed={view === "grid"}
          aria-label="Grid view"
          className={cn("rounded-md p-1.5", view === "grid" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewChange("list")}
          aria-pressed={view === "list"}
          aria-label="List view"
          className={cn("rounded-md p-1.5", view === "list" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <ListIcon className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={onCreateFolder}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <FolderPlus className="h-4 w-4" aria-hidden="true" /> New folder
      </button>
    </div>
  );
}
