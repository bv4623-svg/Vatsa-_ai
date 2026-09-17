"use client";

import { Modal } from "@/components/ui/modal";
import type { ScheduledTask } from "@/types/scheduled-task";

interface ScheduledDeleteConfirmProps {
  task: ScheduledTask | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ScheduledDeleteConfirm({ task, onClose, onConfirm }: ScheduledDeleteConfirmProps) {
  const confirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={!!task} onClose={onClose} size="sm" title={`Delete "${task?.title}"?`}>
      <p className="text-sm text-muted-foreground">
        This can&apos;t be undone. The task will stop running, but any results it already produced stay in your Library.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">Cancel</button>
        <button onClick={confirm} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Delete</button>
      </div>
    </Modal>
  );
}
