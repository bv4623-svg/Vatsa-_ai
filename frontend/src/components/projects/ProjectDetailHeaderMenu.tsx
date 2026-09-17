"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react";

interface ProjectDetailHeaderMenuProps {
  archived: boolean;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export function ProjectDetailHeaderMenu({ archived, onToggleArchive, onDelete }: ProjectDetailHeaderMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Project actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-background p-1 shadow-lg">
            <button role="menuitem" onClick={() => { setOpen(false); onToggleArchive(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
              {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {archived ? "Unarchive" : "Archive"}
            </button>
            <hr className="my-1 border-border" />
            <button role="menuitem" onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
