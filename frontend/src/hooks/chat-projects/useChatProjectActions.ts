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
import { useUpgrade } from "@/components/billing/UpgradeProvider";
import { useToasts } from "@/hooks/useToasts";

interface UseChatProjectActionsArgs {
  refetch: () => Promise<void>;
}

interface ApiErrorBody {
  error?: string;
  used?: number;
  limit?: number;
  message?: string;
}

/** Owns the create/edit modal + delete-confirm state and their mutations
 * for the Projects grid page, mirroring useLibraryModals/useScheduledTaskActions. */
export function useChatProjectActions({ refetch }: UseChatProjectActionsArgs) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ChatProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatProject | null>(null);
  const { openUpgrade } = useUpgrade();
  const { push: notify } = useToasts();

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
      try {
        if (editingProject) await apiUpdateProject(editingProject.id, input as UpdateProjectInput);
        else await apiCreateProject(input);
        setFormOpen(false);
        await refetch();
      } catch (err) {
        const body = (err as Error & { body?: ApiErrorBody })?.body;
        if (body?.error === "project_limit_reached") {
          setFormOpen(false);
          openUpgrade({
            source: "feature_lock",
            reason: body.message || `You've used your ${body.limit} free project${body.limit === 1 ? "" : "s"}.`,
            feature: "projects",
            suggestedTier: "pro",
            limitInfo: body.used != null && body.limit != null ? { used: body.used, limit: body.limit } : undefined,
          });
        } else {
          notify(err instanceof Error ? err.message : "Could not save the project", "error");
        }
      }
    },
    [editingProject, refetch, openUpgrade, notify]
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
