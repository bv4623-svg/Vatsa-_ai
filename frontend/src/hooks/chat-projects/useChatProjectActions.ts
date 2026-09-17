"use client";

import { useCallback, useState } from "react";
import {
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  archiveProject as apiArchiveProject,
  unarchiveProject as apiUnarchiveProject,
} from "@/lib/chat-projects-client";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/chat-projects-client";
import type { ChatProject } from "@/types/chat-project";

interface UseChatProjectActionsArgs {
  refetch: () => Promise<void>;
}

/** Owns the create/edit modal + delete-confirm state and their mutations
 * for the Projects grid page, mirroring useLibraryModals/useScheduledTaskActions. */
export function useChatProjectActions({ refetch }: UseChatProjectActionsArgs) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ChatProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatProject | null>(null);

  const openCreate = useCallback(() => {
    setEditingProject(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((project: ChatProject) => {
    setEditingProject(project);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => setFormOpen(false), []);

  const submitForm = useCallback(
    async (input: CreateProjectInput) => {
      if (editingProject) await apiUpdateProject(editingProject.id, input as UpdateProjectInput);
      else await apiCreateProject(input);
      setFormOpen(false);
      await refetch();
    },
    [editingProject, refetch]
  );

  const toggleArchive = useCallback(
    async (project: ChatProject) => {
      if (project.archived) await apiUnarchiveProject(project.id);
      else await apiArchiveProject(project.id);
      await refetch();
    },
    [refetch]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await apiDeleteProject(deleteTarget.id);
    setDeleteTarget(null);
    await refetch();
  }, [deleteTarget, refetch]);

  return {
    formOpen, editingProject, openCreate, openEdit, closeForm, submitForm,
    deleteTarget, setDeleteTarget, confirmDelete, toggleArchive,
  };
}
