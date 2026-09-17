"use client";

import { useState } from "react";
import { Download, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { LibraryItem } from "@/types/library";

export interface LibraryItemActions {
  onRename: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
  onDownload: (item: LibraryItem) => void;
  onShare: (item: LibraryItem) => void;
}

export function LibraryItemMenu({ item, actions }: { item: LibraryItem; actions: LibraryItemActions }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`More actions for ${item.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-1 text-muted-foreground hover:bg-accent/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-background p-1 shadow-lg">
            <button role="menuitem" onClick={() => { setOpen(false); actions.onRename(item); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
              <Pencil className="h-3.5 w-3.5" /> Rename
            </button>
            {!item.isFolder && (
              <>
                <button role="menuitem" onClick={() => { setOpen(false); actions.onDownload(item); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
                <button role="menuitem" onClick={() => { setOpen(false); actions.onShare(item); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                  <Link2 className="h-3.5 w-3.5" /> {item.shared ? "Manage share link" : "Share"}
                </button>
              </>
            )}
            <hr className="my-1 border-border" />
            <button role="menuitem" onClick={() => { setOpen(false); actions.onDelete(item); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
