"use client";

import { useCallback, useState } from "react";
import {
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  pauseTask as apiPauseTask,
  resumeTask as apiResumeTask,
  runTaskNow as apiRunTaskNow,
} from "@/lib/scheduled-tasks-client";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/scheduled-tasks-client";
import type { ScheduledTask } from "@/types/scheduled-task";

interface UseScheduledTaskActionsArgs {
  refetch: () => Promise<void>;
}

export function useScheduledTaskActions({ refetch }: UseScheduledTaskActionsArgs) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledTask | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setEditingTask(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((task: ScheduledTask) => {
    setEditingTask(task);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => setFormOpen(false), []);

  const submitForm = useCallback(
    async (input: CreateTaskInput) => {
      if (editingTask) await apiUpdateTask(editingTask.id, input as UpdateTaskInput);
      else await apiCreateTask(input);
      setFormOpen(false);
      await refetch();
    },
    [editingTask, refetch]
  );

  const togglePause = useCallback(
    async (task: ScheduledTask) => {
      if (task.status === "active") await apiPauseTask(task.id);
      else await apiResumeTask(task.id);
      await refetch();
    },
    [refetch]
  );

  const runNow = useCallback(
    async (task: ScheduledTask) => {
      setRunningId(task.id);
      try {
        await apiRunTaskNow(task.id);
        // run-now executes in a FastAPI BackgroundTask after this request
        // returns, so there's a real (short) gap before lastRunAt/
        // lastResultId are updated -- this delay just makes the common
        // case feel responsive, not a guarantee of completion.
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await refetch();
      } finally {
        setRunningId(null);
      }
    },
    [refetch]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await apiDeleteTask(deleteTarget.id);
    setDeleteTarget(null);
    await refetch();
  }, [deleteTarget, refetch]);

  return {
    formOpen, editingTask, openCreate, openEdit, closeForm, submitForm,
    deleteTarget, setDeleteTarget, confirmDelete,
    togglePause, runNow, runningId,
  };
}
