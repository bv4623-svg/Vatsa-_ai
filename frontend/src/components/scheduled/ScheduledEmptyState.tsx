"use client";

import { Clock, Plus } from "lucide-react";

interface ScheduledEmptyStateProps {
  onCreate: () => void;
}

export function ScheduledEmptyState({ onCreate }: ScheduledEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <Clock className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">Create your first scheduled task</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        A saved prompt that runs automatically on a schedule you choose, with the result saved to your Library.
      </p>
      <button
        onClick={onCreate}
        className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> New scheduled task
      </button>
    </div>
  );
}
