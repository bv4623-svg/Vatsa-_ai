"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectDetailHeaderMenu } from "./ProjectDetailHeaderMenu";
import type { ChatProject } from "@/types/chat-project";

interface ProjectDetailHeaderProps {
  project: ChatProject;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export function ProjectDetailHeader({ project, onToggleArchive, onDelete }: ProjectDetailHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur-sm">
      <Link
        href="/projects"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Projects
      </Link>
      <div className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
      <h1 className="truncate text-sm font-semibold text-foreground">{project.name}</h1>
      {project.archived && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Archived
        </span>
      )}
      <div className="ml-auto">
        <ProjectDetailHeaderMenu archived={project.archived} onToggleArchive={onToggleArchive} onDelete={onDelete} />
      </div>
    </header>
  );
}
