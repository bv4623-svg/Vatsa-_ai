"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDetailHeader } from "./ProjectDetailHeader";
import { ProjectDetailTabs, type ProjectTab } from "./ProjectDetailTabs";
import { ProjectChatsTab } from "./ProjectChatsTab";
import { ProjectFilesTab } from "./ProjectFilesTab";
import { ProjectSettingsTab } from "./ProjectSettingsTab";
import { ProjectDeleteConfirm } from "./ProjectDeleteConfirm";
import { useChatProjectDetail } from "@/hooks/chat-projects/useChatProjectDetail";
import { deleteProject } from "@/lib/chat-projects-client";

export function ProjectDetailContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<ProjectTab>("chats");
  const p = useChatProjectDetail(projectId);

  if (p.loading && !p.project) {
    return (
      <div className="flex-1 p-4">
        <div className="h-32 animate-pulse rounded-xl bg-accent/5" />
      </div>
    );
  }
  if (p.error || !p.project) {
    return <div className="flex-1 p-4 text-sm text-red-500">{p.error || "Project not found."}</div>;
  }

  const project = p.project;

  const handleDelete = async () => {
    await deleteProject(project.id);
    router.push("/projects");
  };

  return (
    <>
      <ProjectDetailHeader project={project} onToggleArchive={p.toggleArchive} onDelete={() => p.setDeleteOpen(true)} />
      <ProjectDetailTabs active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "chats" && (
          <ProjectChatsTab
            project={project}
            addOpen={p.addChatOpen}
            onAddOpen={() => p.setAddChatOpen(true)}
            onAddClose={() => p.setAddChatOpen(false)}
            onAdd={p.addChat}
            onRemove={p.removeChat}
          />
        )}
        {tab === "files" && (
          <ProjectFilesTab
            project={project}
            addOpen={p.addFileOpen}
            onAddOpen={() => p.setAddFileOpen(true)}
            onAddClose={() => p.setAddFileOpen(false)}
            onAdd={p.addFile}
            onRemove={p.removeFile}
          />
        )}
        {tab === "settings" && <ProjectSettingsTab project={project} onSave={p.saveSettings} />}
      </div>
      <ProjectDeleteConfirm project={p.deleteOpen ? project : null} onClose={() => p.setDeleteOpen(false)} onConfirm={handleDelete} />
    </>
  );
}
