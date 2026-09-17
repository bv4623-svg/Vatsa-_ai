"use client";

import { useScheduledTasks } from "./useScheduledTasks";
import { useScheduledTaskActions } from "./useScheduledTaskActions";

export function useScheduledTasksPage() {
  const list = useScheduledTasks();
  const actions = useScheduledTaskActions({ refetch: list.refetch });

  return { ...list, ...actions };
}
