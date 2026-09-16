import apiClient from "@/lib/axios";
import type { Memory, MemoryQuery } from "../types/memory";

export const memoryService = {
  getMemories: (params?: MemoryQuery) => apiClient.get<Memory[]>("/api/memory", { params }),
  createMemory: (data: Partial<Memory>) => apiClient.post<Memory>("/api/memory", data),
  updateMemory: (id: number, data: Partial<Memory>) => apiClient.put<Memory>(`/api/memory/${id}`, data),
  deleteMemory: (id: number) => apiClient.delete(`/api/memory/${id}`),
  clearAllMemories: () => apiClient.delete("/api/memory"),
};
