"use client";

import { Modal } from "@/components/ui/modal";
import { ProjectForm } from "./ProjectForm";
import type { CreateProjectInput } from "@/lib/chat-projects-client";
import type { ChatProject } from "@/types/chat-project";

interface ProjectFormModalProps {
  open: boolean;
  project: ChatProject | null;
  onClose: () => void;
  onSubmit: (input: CreateProjectInput) => Promise<void> | void;
}

export function ProjectFormModal({ open, project, onClose, onSubmit }: ProjectFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title={project ? "Edit project" : "New project"}>
      {open && <ProjectForm key={project?.id ?? "new"} project={project} onClose={onClose} onSubmit={onSubmit} />}
    </Modal>
  );
}
