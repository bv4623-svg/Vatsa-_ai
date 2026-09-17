"use client";

import { Modal } from "@/components/ui/modal";
import type { ChatProject } from "@/types/chat-project";

interface ProjectDeleteConfirmProps {
  project: ChatProject | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ProjectDeleteConfirm({ project, onClose, onConfirm }: ProjectDeleteConfirmProps) {
  const confirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={!!project} onClose={onClose} size="sm" title={`Delete "${project?.name}"?`}>
      <p className="text-sm text-muted-foreground">
        This can&apos;t be undone. Chats and files stay -- they&apos;re just detached from the project, not deleted.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">Cancel</button>
        <button onClick={confirm} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Delete</button>
      </div>
    </Modal>
  );
}
