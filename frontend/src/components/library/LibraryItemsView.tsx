"use client";

import { LibraryItemCard } from "./LibraryItemCard";
import { LibraryItemRow } from "./LibraryItemRow";
import { LibraryEmptyState } from "./LibraryEmptyState";
import type { LibraryItemActions } from "./LibraryItemMenu";
import type { LibraryItem, LibraryViewMode } from "@/types/library";

interface LibraryItemsViewProps {
  items: LibraryItem[];
  view: LibraryViewMode;
  search: string;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (item: LibraryItem) => void;
  actions: LibraryItemActions;
}

export function LibraryItemsView({ items, view, search, selected, onToggleSelect, onOpen, actions }: LibraryItemsViewProps) {
  if (items.length === 0) return <LibraryEmptyState search={search} />;

  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <LibraryItemCard key={item.id} item={item} selected={selected.has(item.id)} onToggleSelect={onToggleSelect} onOpen={onOpen} actions={actions} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/40">
      {items.map((item) => (
        <LibraryItemRow key={item.id} item={item} selected={selected.has(item.id)} onToggleSelect={onToggleSelect} onOpen={onOpen} actions={actions} />
      ))}
    </div>
  );
}
