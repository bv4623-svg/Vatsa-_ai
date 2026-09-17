"use client";

import { cn } from "@/lib/utils";
import { cronToDraft, describeSchedule, formatInTimezone } from "@/lib/scheduled-tasks-client";
import { ScheduledTaskMenu, type ScheduledTaskActions } from "./ScheduledTaskMenu";
import type { ScheduledTask } from "@/types/scheduled-task";

interface ScheduledTaskRowProps {
  task: ScheduledTask;
  viewerTimezone: string;
  running: boolean;
  actions: ScheduledTaskActions;
}

export function ScheduledTaskRow({ task, viewerTimezone, running, actions }: ScheduledTaskRowProps) {
  const paused = task.status === "paused";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              paused ? "bg-muted text-muted-foreground" : "bg-green-500/10 text-green-500"
            )}
          >
            {paused ? "Paused" : "Active"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.prompt}</p>
      </div>

      <div className="hidden shrink-0 flex-col text-right text-xs text-muted-foreground sm:flex">
        <span>{describeSchedule(cronToDraft(task.schedule))}</span>
        <span>Next: {paused ? "—" : formatInTimezone(task.nextRunAt, viewerTimezone)}</span>
      </div>

      <ScheduledTaskMenu task={task} actions={actions} running={running} />
    </div>
  );
}
