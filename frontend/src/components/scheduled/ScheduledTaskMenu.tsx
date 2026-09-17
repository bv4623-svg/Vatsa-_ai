"use client";

import { useState } from "react";
import { MoreHorizontal, Pause, Pencil, Play, Trash2, Zap } from "lucide-react";
import type { ScheduledTask } from "@/types/scheduled-task";

export interface ScheduledTaskActions {
  onEdit: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
  onTogglePause: (task: ScheduledTask) => void;
  onRunNow: (task: ScheduledTask) => void;
}

export function ScheduledTaskMenu({ task, actions, running }: { task: ScheduledTask; actions: ScheduledTaskActions; running: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`More actions for ${task.title}`}
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
            <button role="menuitem" disabled={running} onClick={() => { setOpen(false); actions.onRunNow(task); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10 disabled:opacity-50">
              <Zap className="h-3.5 w-3.5" /> {running ? "Running..." : "Run now"}
            </button>
            <button role="menuitem" onClick={() => { setOpen(false); actions.onEdit(task); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button role="menuitem" onClick={() => { setOpen(false); actions.onTogglePause(task); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
              {task.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {task.status === "active" ? "Pause" : "Resume"}
            </button>
            <hr className="my-1 border-border" />
            <button role="menuitem" onClick={() => { setOpen(false); actions.onDelete(task); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
