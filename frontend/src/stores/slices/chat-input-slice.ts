// Chat input & streaming state slice
import type { FocusMode, ModelOption, RoutingInfo, Source, OrchestrationStep } from "@/types";
import type { StateCreator } from "zustand";

export interface ChatInputSlice {
  inputText: string;
  focusMode: FocusMode;
  webSearchEnabled: boolean;
  selectedModel: ModelOption;
  isStreaming: boolean;
  isProcessing: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: "sources" | "outline" | "tools";
  routingInfo: RoutingInfo | null;
  activeSources: Source[];
  orchestrationSteps: OrchestrationStep[];
  draftMessage: string;
  scrollPosition: number;
  setInputText: (text: string) => void;
  setFocusMode: (mode: FocusMode) => void;
  setWebSearchEnabled: (v: boolean) => void;
  setSelectedModel: (model: ModelOption) => void;
  setIsStreaming: (v: boolean) => void;
  setIsProcessing: (v: boolean) => void;
  setRightPanelOpen: (v: boolean) => void;
  setRightPanelTab: (tab: ChatInputSlice["rightPanelTab"]) => void;
  setRoutingInfo: (info: RoutingInfo | null) => void;
  setActiveSources: (sources: Source[]) => void;
  setOrchestrationSteps: (steps: OrchestrationStep[]) => void;
  setDraftMessage: (msg: string) => void;
  setScrollPosition: (pos: number) => void;
}

export const createChatInputSlice: StateCreator<ChatInputSlice, [], [], ChatInputSlice> = (set) => ({
  inputText: "",
  focusMode: "all",
  webSearchEnabled: true,
  selectedModel: "auto",
  isStreaming: false,
  isProcessing: false,
  rightPanelOpen: false,
  rightPanelTab: "sources",
  routingInfo: null,
  activeSources: [],
  orchestrationSteps: [],
  draftMessage: "",
  scrollPosition: 0,

  setInputText: (text) => set({ inputText: text }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setWebSearchEnabled: (v) => set({ webSearchEnabled: v }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setRightPanelOpen: (v) => set({ rightPanelOpen: v }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
  setRoutingInfo: (info) => set({ routingInfo: info }),
  setActiveSources: (sources) => set({ activeSources: sources || [] }),
  setOrchestrationSteps: (steps) => set({ orchestrationSteps: steps || [] }),
  setDraftMessage: (msg) => set({ draftMessage: msg }),
  setScrollPosition: (pos) => set({ scrollPosition: pos }),
});
