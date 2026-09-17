"use client";

import { useRouter } from "next/navigation";
import { FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectCardMenu, type ProjectCardActions } from "./ProjectCardMenu";
import type { ChatProject } from "@/types/chat-project";

interface ProjectCardProps {
  project: ChatProject;
  actions: ProjectCardActions;
}

export function ProjectCard({ project, actions }: ProjectCardProps) {
  const router = useRouter();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/projects/${project.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/projects/${project.id}`); }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/60 p-4 text-left transition-colors hover:bg-accent/5",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-medium text-foreground">{project.name}</h3>
        <ProjectCardMenu project={project} actions={actions} />
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">
        {project.description || "No description"}
      </p>

      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {project.chatIds.length}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {project.fileIds.length}
        </span>
        {project.archived && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Archived
          </span>
        )}
      </div>
    </div>
  );
}
