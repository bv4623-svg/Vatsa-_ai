"use client";

import { Plus, X } from "lucide-react";
import { useProjectChatPicker } from "@/hooks/chat-projects/useProjectChatPicker";
import { ProjectAddChatModal } from "./ProjectAddChatModal";
import type { ChatProject } from "@/types/chat-project";

interface ProjectChatsTabProps {
  project: ChatProject;
  addOpen: boolean;
  onAddOpen: () => void;
  onAddClose: () => void;
  onAdd: (conversationId: string) => Promise<void> | void;
  onRemove: (conversationId: string) => Promise<void> | void;
}

export function ProjectChatsTab({ project, addOpen, onAddOpen, onAddClose, onAdd, onRemove }: ProjectChatsTabProps) {
  const { chats, loading } = useProjectChatPicker();
  const projectChats = chats.filter((c) => project.chatIds.includes(c.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{project.chatIds.length} chat{project.chatIds.length === 1 ? "" : "s"}</p>
        <button onClick={onAddOpen} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-accent/10">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add chat
        </button>
      </div>

      {loading && <div className="h-16 animate-pulse rounded-lg bg-accent/5" />}
      {!loading && projectChats.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No chats in this project yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {projectChats.map((chat) => (
          <div key={chat.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <span className="truncate text-sm text-foreground">{chat.title}</span>
            <button
              onClick={() => onRemove(chat.id)}
              aria-label={`Remove ${chat.title} from project`}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent/20 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <ProjectAddChatModal open={addOpen} excludeIds={project.chatIds} onClose={onAddClose} onAdd={onAdd} />
    </div>
  );
}
