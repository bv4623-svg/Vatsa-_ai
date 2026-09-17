"use client";

import { ProjectSettingsForm } from "./ProjectSettingsForm";
import type { UpdateProjectInput } from "@/lib/chat-projects-client";
import type { ChatProject } from "@/types/chat-project";

interface ProjectSettingsTabProps {
  project: ChatProject;
  onSave: (patch: UpdateProjectInput) => Promise<void> | void;
}

export function ProjectSettingsTab({ project, onSave }: ProjectSettingsTabProps) {
  return <ProjectSettingsForm key={project.id} project={project} onSave={onSave} />;
}
