"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getProject, updateProject, archiveProject, unarchiveProject,
  addProjectChat, removeProjectChat, addProjectFile, removeProjectFile,
} from "@/lib/chat-projects-client";
import type { UpdateProjectInput } from "@/lib/chat-projects-client";
import { createAsyncQueryStore, getInitialQueryState } from "@/hooks/shared/asyncResource";
import type { ChatProject } from "@/types/chat-project";

export function useChatProjectDetail(projectId: string) {
  const store = useMemo(() => createAsyncQueryStore<ChatProject>(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialQueryState<ChatProject>);
  const [addChatOpen, setAddChatOpen] = useState(false);
  const [addFileOpen, setAddFileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refetch = useCallback(() => store.run(() => getProject(projectId)), [store, projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const saveSettings = useCallback(
    async (patch: UpdateProjectInput) => {
      await updateProject(projectId, patch);
      await refetch();
    },
    [projectId, refetch]
  );

  const toggleArchive = useCallback(async () => {
    if (state.data?.archived) await unarchiveProject(projectId);
    else await archiveProject(projectId);
    await refetch();
  }, [projectId, refetch, state.data?.archived]);

  const addChat = useCallback(
    async (conversationId: string) => {
      await addProjectChat(projectId, conversationId);
      await refetch();
      setAddChatOpen(false);
    },
    [projectId, refetch]
  );

  const removeChat = useCallback(
    async (conversationId: string) => {
      await removeProjectChat(projectId, conversationId);
      await refetch();
    },
    [projectId, refetch]
  );

  const addFile = useCallback(
    async (itemId: string) => {
      await addProjectFile(projectId, itemId);
      await refetch();
      setAddFileOpen(false);
    },
    [projectId, refetch]
  );

  const removeFile = useCallback(
    async (itemId: string) => {
      await removeProjectFile(projectId, itemId);
      await refetch();
    },
    [projectId, refetch]
  );

  return {
    project: state.data, loading: state.loading, error: state.error, refetch,
    saveSettings, toggleArchive, addChat, removeChat, addFile, removeFile,
    addChatOpen, setAddChatOpen, addFileOpen, setAddFileOpen, deleteOpen, setDeleteOpen,
  };
}
