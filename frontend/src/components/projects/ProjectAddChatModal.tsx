"use client";

import { Modal } from "@/components/ui/modal";
import { useProjectChatPicker } from "@/hooks/chat-projects/useProjectChatPicker";
import type { ProjectPickerChat } from "@/lib/chat-projects-client";

interface ProjectAddChatModalProps {
  open: boolean;
  excludeIds: string[];
  onClose: () => void;
  onAdd: (conversationId: string) => Promise<void> | void;
}

export function ProjectAddChatModal({ open, excludeIds, onClose, onAdd }: ProjectAddChatModalProps) {
  const { chats, loading } = useProjectChatPicker();
  const available = chats.filter((c) => !excludeIds.includes(c.id));

  return (
    <Modal open={open} onClose={onClose} size="md" title="Add a chat">
      {loading && <div className="h-24 animate-pulse rounded-lg bg-accent/5" />}
      {!loading && available.length === 0 && (
        <p className="text-sm text-muted-foreground">No other chats to add.</p>
      )}
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {available.map((chat: ProjectPickerChat) => (
          <button
            key={chat.id}
            onClick={() => onAdd(chat.id)}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/10"
          >
            <span className="truncate">{chat.title}</span>
            {chat.projectId && <span className="shrink-0 text-xs text-muted-foreground">In another project</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
