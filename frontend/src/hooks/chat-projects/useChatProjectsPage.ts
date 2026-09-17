"use client";

import { useChatProjects } from "./useChatProjects";
import { useChatProjectActions } from "./useChatProjectActions";

export function useChatProjectsPage() {
  const list = useChatProjects();
  const actions = useChatProjectActions({ refetch: list.refetch });

  return { ...list, ...actions };
}
