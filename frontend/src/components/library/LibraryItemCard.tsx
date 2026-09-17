"use client";

import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format-bytes";
import { LibraryItemIcon } from "./LibraryItemIcon";
import { LibraryItemMenu, type LibraryItemActions } from "./LibraryItemMenu";
import type { LibraryItem } from "@/types/library";

interface LibraryItemCardProps {
  item: LibraryItem;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (item: LibraryItem) => void;
  actions: LibraryItemActions;
}

export function LibraryItemCard({ item, selected, onToggleSelect, onOpen, actions }: LibraryItemCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(item); }}
      className={cn(
        "group relative flex flex-col rounded-xl border p-3 text-left transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected ? "border-accent bg-accent/10" : "border-border/60 hover:border-border hover:bg-accent/5"
      )}
    >
      <div className="flex items-start justify-between">
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect(item.id)}
          aria-label={`Select ${item.name}`}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        <LibraryItemMenu item={item} actions={actions} />
      </div>

      <div className="mt-3 flex h-16 items-center justify-center">
        <LibraryItemIcon type={item.type} isFolder={item.isFolder} className="h-9 w-9 text-muted-foreground" />
      </div>

      <p className="mt-2 truncate text-sm font-medium text-foreground" title={item.name}>{item.name}</p>
      <p className="text-xs text-muted-foreground">{item.isFolder ? "Folder" : formatBytes(item.sizeBytes)}</p>
    </div>
  );
}
