"use client";

import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format-bytes";
import { LibraryItemIcon } from "./LibraryItemIcon";
import { LibraryItemMenu, type LibraryItemActions } from "./LibraryItemMenu";
import type { LibraryItem } from "@/types/library";

interface LibraryItemRowProps {
  item: LibraryItem;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (item: LibraryItem) => void;
  actions: LibraryItemActions;
}

export function LibraryItemRow({ item, selected, onToggleSelect, onOpen, actions }: LibraryItemRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(item); }}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected ? "bg-accent/10" : "hover:bg-accent/5"
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleSelect(item.id)}
        aria-label={`Select ${item.name}`}
        className="h-4 w-4 shrink-0 rounded border-border accent-accent"
      />
      <LibraryItemIcon type={item.type} isFolder={item.isFolder} className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.name}</span>
      <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
        {item.isFolder ? "—" : formatBytes(item.sizeBytes)}
      </span>
      <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground md:block">
        {new Date(item.updatedAt).toLocaleDateString()}
      </span>
      <LibraryItemMenu item={item} actions={actions} />
    </div>
  );
}
