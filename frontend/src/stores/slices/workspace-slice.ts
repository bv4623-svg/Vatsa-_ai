// Workspace/storage/models slice
import type { FeatureFlags } from "@/types";
import type { StateCreator } from "zustand";

export interface Workspace { id: number; name: string; }
export interface ModelInfo { id: string; name: string; provider?: string; tier?: "free" | "pro"; }

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  multiAgent: false,
  aiDebate: false,
  parallelResponses: false,
  promptImprovement: true,
  autoToolSelection: true,
  codeExecution: false,
  scheduledTasks: false,
  backgroundAgents: false,
  customPersonas: false,
  customInstructions: false,
};

export interface WorkspaceSlice {
  workspaces: Workspace[];
  currentWorkspaceId: number;
  storageUsed: number;
  storageTotal: number;
  extensionsCount: number;
  availableModels: ModelInfo[];
  featureFlags: FeatureFlags;
  setWorkspaces: (workspaces: Workspace[], currentId: number) => void;
  setStorage: (used: number, total: number) => void;
  setExtensions: (count: number) => void;
  setAvailableModels: (models: ModelInfo[]) => void;
  toggleFeature: (feature: keyof FeatureFlags) => void;
}

export const createWorkspaceSlice: StateCreator<WorkspaceSlice, [], [], WorkspaceSlice> = (set) => ({
  workspaces: [],
  currentWorkspaceId: 0,
  storageUsed: 0,
  storageTotal: 0,
  extensionsCount: 0,
  availableModels: [],
  featureFlags: DEFAULT_FEATURE_FLAGS,

  setWorkspaces: (workspaces, currentId) => set({ workspaces, currentWorkspaceId: currentId }),
  setStorage: (used, total) => set({ storageUsed: used, storageTotal: total }),
  setExtensions: (count) => set({ extensionsCount: count }),
  setAvailableModels: (models) => set({ availableModels: models }),
  toggleFeature: (feature) =>
    set((s) => ({
      featureFlags: { ...s.featureFlags, [feature]: !s.featureFlags[feature] },
    })),
});
