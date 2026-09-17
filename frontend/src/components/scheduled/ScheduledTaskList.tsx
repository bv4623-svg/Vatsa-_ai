"use client";

import { ScheduledTaskRow } from "./ScheduledTaskRow";
import type { ScheduledTaskActions } from "./ScheduledTaskMenu";
import type { ScheduledTask } from "@/types/scheduled-task";

interface ScheduledTaskListProps {
  tasks: ScheduledTask[];
  viewerTimezone: string;
  runningId: string | null;
  actions: ScheduledTaskActions;
}

export function ScheduledTaskList({ tasks, viewerTimezone, runningId, actions }: ScheduledTaskListProps) {
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <ScheduledTaskRow key={task.id} task={task} viewerTimezone={viewerTimezone} running={runningId === task.id} actions={actions} />
      ))}
    </div>
  );
}
