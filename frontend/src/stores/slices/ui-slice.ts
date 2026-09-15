// UI state slice — sidebar, modals, toasts, loading flags
import type { Toast } from "@/types";
import type { StateCreator } from "zustand";

export interface UISlice {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  isCanvasOpen: boolean;
  isHistoryOpen: boolean;
  showPricingModal: boolean;
  selectedPricingPlan: string | null;
  isLoading: boolean;
  toasts: Toast[];
  activeTab: string;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setCanvasOpen: (v: boolean) => void;
  setHistoryOpen: (v: boolean) => void;
  setShowPricingModal: (v: boolean) => void;
  setSelectedPricingPlan: (id: string | null) => void;
  setLoading: (v: boolean) => void;
  setActiveTab: (tab: string) => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
  sidebarCollapsed: false,
  sidebarOpen: true,
  commandPaletteOpen: false,
  isSettingsOpen: false,
  isCanvasOpen: false,
  isHistoryOpen: false,
  showPricingModal: false,
  selectedPricingPlan: null,
  isLoading: false,
  toasts: [],
  activeTab: "chat",

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setCanvasOpen: (v) => set({ isCanvasOpen: v }),
  setHistoryOpen: (v) => set({ isHistoryOpen: v }),
  setShowPricingModal: (v) => set({ showPricingModal: v }),
  setSelectedPricingPlan: (id) => set({ selectedPricingPlan: id }),
  setLoading: (v) => set({ isLoading: v }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: Toast = { ...toast, id };
    set((s) => ({ toasts: [...s.toasts, newToast] }));
    setTimeout(() => get().removeToast(id), toast.duration || 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
});
