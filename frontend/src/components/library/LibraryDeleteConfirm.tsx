"use client";

import { Modal } from "@/components/ui/modal";
import type { LibraryItem } from "@/types/library";

interface LibraryDeleteConfirmProps {
  item: LibraryItem | LibraryItem[] | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function LibraryDeleteConfirm({ item, onClose, onConfirm }: LibraryDeleteConfirmProps) {
  const items = Array.isArray(item) ? item : item ? [item] : [];
  const isBulk = items.length > 1;
  const hasFolder = items.some((i) => i.isFolder);

  const confirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={items.length > 0} onClose={onClose} size="sm" title={isBulk ? `Delete ${items.length} items?` : `Delete "${items[0]?.name}"?`}>
      <p className="text-sm text-muted-foreground">
        This can&apos;t be undone.
        {hasFolder && " Deleting a folder also deletes everything inside it."}
        {items.some((i) => i.type === "chat" || i.type === "code") && " Chats and code projects are permanently removed, not just hidden."}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">Cancel</button>
        <button onClick={confirm} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Delete</button>
      </div>
    </Modal>
  );
}
