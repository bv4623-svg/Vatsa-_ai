import { create } from "zustand";
import { memoryService } from "../services/memory.service";
import type { Memory } from "../types/memory";

interface MemoryStore {
  memories: Memory[];
  isLoading: boolean;
  error: string | null;
  fetchMemories: (params?: { type?: string; category?: string }) => Promise<void>;
  deleteMemory: (id: number) => Promise<void>;
  updateMemory: (id: number, data: Partial<Memory>) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  isLoading: false,
  error: null,

  fetchMemories: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await memoryService.getMemories(params);
      set({ memories: response.data, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to fetch memories", isLoading: false });
    }
  },

  deleteMemory: async (id) => {
    try {
      await memoryService.deleteMemory(id);
      set({ memories: get().memories.filter((memory) => memory.id !== id) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to delete memory" });
    }
  },

  updateMemory: async (id, data) => {
    try {
      const response = await memoryService.updateMemory(id, data);
      set({ memories: get().memories.map((memory) => memory.id === id ? response.data : memory) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to update memory" });
    }
  },

  clearAll: async () => {
    try {
      await memoryService.clearAllMemories();
      set({ memories: [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to clear memories" });
    }
  },
}));
