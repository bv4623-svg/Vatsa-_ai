"use client";

import { Modal } from "@/components/ui/modal";
import { formatBytes } from "@/lib/format-bytes";
import { useProjectFilePicker } from "@/hooks/chat-projects/useProjectFilePicker";

interface ProjectAddFileModalProps {
  open: boolean;
  excludeIds: string[];
  onClose: () => void;
  onAdd: (itemId: string) => Promise<void> | void;
}

export function ProjectAddFileModal({ open, excludeIds, onClose, onAdd }: ProjectAddFileModalProps) {
  const { files, loading } = useProjectFilePicker();
  const available = files.filter((f) => !excludeIds.includes(f.id));

  return (
    <Modal open={open} onClose={onClose} size="md" title="Add a file from Library">
      {loading && <div className="h-24 animate-pulse rounded-lg bg-accent/5" />}
      {!loading && available.length === 0 && (
        <p className="text-sm text-muted-foreground">No other files to add.</p>
      )}
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {available.map((file) => (
          <button
            key={file.id}
            onClick={() => onAdd(file.id)}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/10"
          >
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
