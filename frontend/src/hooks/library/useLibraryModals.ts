"use client";

import { useCallback, useState } from "react";
import {
  bulkDelete as apiBulkDelete,
  createFolder as apiCreateFolder,
  deleteItem as apiDeleteItem,
  updateItem as apiUpdateItem,
} from "@/lib/library-client";
import type { LibraryItem } from "@/types/library";

interface UseLibraryModalsArgs {
  currentFolderId: string;
  refetch: () => Promise<void>;
  refetchStorage: () => Promise<void>;
  clearSelection: () => void;
}

/** Owns every Library modal's open/target state plus the mutation it
 * commits, so the page hook only has to render them. */
export function useLibraryModals({ currentFolderId, refetch, refetchStorage, clearSelection }: UseLibraryModalsArgs) {
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LibraryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryItem | LibraryItem[] | null>(null);
  const [shareTarget, setShareTarget] = useState<LibraryItem | null>(null);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      await apiCreateFolder(name, currentFolderId || null);
      await refetch();
    },
    [currentFolderId, refetch]
  );

  const handleRename = useCallback(
    async (id: string, name: string) => {
      await apiUpdateItem(id, { name });
      await refetch();
    },
    [refetch]
  );

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteTarget) return;
    const targets = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
    if (targets.length === 1) await apiDeleteItem(targets[0].id);
    else await apiBulkDelete(targets.map((t) => t.id));
    clearSelection();
    await Promise.all([refetch(), refetchStorage()]);
  }, [deleteTarget, refetch, refetchStorage, clearSelection]);

  return {
    folderModalOpen, setFolderModalOpen, handleCreateFolder,
    renameTarget, setRenameTarget, handleRename,
    deleteTarget, setDeleteTarget, handleDeleteConfirmed,
    shareTarget, setShareTarget,
  };
}
