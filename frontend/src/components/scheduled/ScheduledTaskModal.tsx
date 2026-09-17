"use client";

import { Modal } from "@/components/ui/modal";
import { ScheduledTaskForm } from "./ScheduledTaskForm";
import type { CreateTaskInput } from "@/lib/scheduled-tasks-client";
import type { ScheduledTask } from "@/types/scheduled-task";

interface ScheduledTaskModalProps {
  open: boolean;
  task: ScheduledTask | null;
  defaultTimezone: string;
  onClose: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void> | void;
}

export function ScheduledTaskModal({ open, task, defaultTimezone, onClose, onSubmit }: ScheduledTaskModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title={task ? "Edit scheduled task" : "New scheduled task"}>
      {open && (
        <ScheduledTaskForm key={task?.id ?? "new"} task={task} defaultTimezone={defaultTimezone} onClose={onClose} onSubmit={onSubmit} />
      )}
    </Modal>
  );
}
