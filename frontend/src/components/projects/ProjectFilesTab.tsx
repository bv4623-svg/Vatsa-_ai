"use client";

import { Plus, X } from "lucide-react";
import { formatBytes } from "@/lib/format-bytes";
import { useProjectFilePicker } from "@/hooks/chat-projects/useProjectFilePicker";
import { ProjectAddFileModal } from "./ProjectAddFileModal";
import type { ChatProject } from "@/types/chat-project";

interface ProjectFilesTabProps {
  project: ChatProject;
  addOpen: boolean;
  onAddOpen: () => void;
  onAddClose: () => void;
  onAdd: (itemId: string) => Promise<void> | void;
  onRemove: (itemId: string) => Promise<void> | void;
}

export function ProjectFilesTab({ project, addOpen, onAddOpen, onAddClose, onAdd, onRemove }: ProjectFilesTabProps) {
  const { files, loading } = useProjectFilePicker();
  const projectFiles = files.filter((f) => project.fileIds.includes(f.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{project.fileIds.length} file{project.fileIds.length === 1 ? "" : "s"}</p>
        <button onClick={onAddOpen} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-accent/10">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add file
        </button>
      </div>

      {loading && <div className="h-16 animate-pulse rounded-lg bg-accent/5" />}
      {!loading && projectFiles.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No files added from your Library yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {projectFiles.map((file) => (
          <div key={file.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <span className="truncate text-sm text-foreground">{file.name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</span>
              <button
                onClick={() => onRemove(file.id)}
                aria-label={`Remove ${file.name} from project`}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent/20 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ProjectAddFileModal open={addOpen} excludeIds={project.fileIds} onClose={onAddClose} onAdd={onAdd} />
    </div>
  );
}
