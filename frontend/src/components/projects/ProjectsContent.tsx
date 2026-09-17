"use client";

import { Plus } from "lucide-react";
import { useChatProjectsPage } from "@/hooks/chat-projects/useChatProjectsPage";
import { ProjectCard } from "./ProjectCard";
import { ProjectEmptyState } from "./ProjectEmptyState";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectDeleteConfirm } from "./ProjectDeleteConfirm";
import type { ProjectCardActions } from "./ProjectCardMenu";

export function ProjectsContent() {
  const p = useChatProjectsPage();

  const actions: ProjectCardActions = {
    onEdit: p.openEdit,
    onDelete: p.setDeleteTarget,
    onToggleArchive: p.toggleArchive,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {p.projects.length} project{p.projects.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={p.openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> New project
        </button>
      </div>

      {p.error && <p className="text-sm text-red-500">{p.error}</p>}

      {!p.loading && p.projects.length === 0 ? (
        <ProjectEmptyState onCreate={p.openCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {p.projects.map((project) => (
            <ProjectCard key={project.id} project={project} actions={actions} />
          ))}
        </div>
      )}

      <ProjectFormModal open={p.formOpen} project={p.editingProject} onClose={p.closeForm} onSubmit={p.submitForm} />
      <ProjectDeleteConfirm project={p.deleteTarget} onClose={() => p.setDeleteTarget(null)} onConfirm={p.confirmDelete} />
    </div>
  );
}
