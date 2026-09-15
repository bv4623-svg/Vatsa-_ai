// frontend/src/stores/app-store.ts
// Combined store — all slices composed here for backward compatibility.
// New code should import from @/stores/slices/* directly when possible.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useMemo } from "react";
import { chat, type User } from "@/services/chat";
import { loadWorkspace, makeChat, makeMessage, titleFromText, uid } from "@/utils/workspace";
import type {
  Conversation, FocusMode, ModelOption, Message, RoutingInfo,
  Source, Toast, OrchestrationStep, PricingPlan, UserSubscription,
  FeatureFlags, AppSettings,
} from "@/types";

// ─── DEFAULT_SETTINGS inlined to avoid missing file dependency ─────────────
export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  accentColor: "#7c3aed",
  language: "en",
  fontSize: "medium",
  toastDuration: 4000,
  showCodeBlocks: true,
  enableMarkdown: true,
  autoSave: true,
  autoSaveInterval: 30000,
};

// ─── Pricing Plans (public constant) ─────────────────────────────────────────
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free", name: "Free", price: 0, cta: "Start free",
    features: [
      { label: "Basic chat", included: true },
      { label: "Web search", included: false },
      { label: "Custom models", included: false },
    ],
  },
  {
    id: "pro", name: "Pro", price: 19.99, cta: "Upgrade to Pro",
    features: [
      { label: "Basic chat", included: true },
      { label: "Web search", included: true },
      { label: "Custom models", included: true },
    ],
  },
];

// ─── Internal types ───────────────────────────────────────────────────────────
export interface Workspace { id: number; name: string; }
export interface ModelInfo { id: string; name: string; provider?: string; tier?: "free" | "pro"; }
type ExtendedConversation = Conversation & { favorite?: boolean; isPrivate?: boolean; };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const getInitialState = () => ({
  _hasHydrated: false,
  user: null as User | null,
  isAuthenticated: false,
  userId: null as string | null,
  userTier: "free" as "free" | "premium",
  subscription: null as UserSubscription | null,
  settings: DEFAULT_SETTINGS,
  sidebarCollapsed: false,
  sidebarOpen: true,
  inputText: "",
  focusMode: "all" as FocusMode,
  webSearchEnabled: true,
  selectedModel: "auto" as ModelOption,
  isStreaming: false,
  isProcessing: false,
  rightPanelOpen: false,
  rightPanelTab: "sources" as "sources" | "outline" | "tools",
  commandPaletteOpen: false,
  routingInfo: null as RoutingInfo | null,
  activeSources: [] as Source[],
  orchestrationSteps: [] as OrchestrationStep[],
  toasts: [] as Toast[],
  isLoading: false,
  isSettingsOpen: false,
  isCanvasOpen: false,
  isHistoryOpen: false,
  selectedPricingPlan: null as string | null,
  showPricingModal: false,
  featureFlags: {
    multiAgent: false, aiDebate: false, parallelResponses: false,
    promptImprovement: true, autoToolSelection: true, codeExecution: false,
    scheduledTasks: false, backgroundAgents: false, customPersonas: false,
    customInstructions: false,
  } as FeatureFlags,
  workspaces: [] as Workspace[],
  currentWorkspaceId: 0,
  storageUsed: 0,
  storageTotal: 0,
  extensionsCount: 0,
  availableModels: [] as ModelInfo[],
  conversations: [] as ExtendedConversation[],
  activeConversationId: null as string | null,
  memories: [] as { id: string; text: string; createdAt: string }[],
  draftMessage: "",
  scrollPosition: 0,
  activeTab: "chat",
});

// ─── Interface ────────────────────────────────────────────────────────────────
interface AppState extends ReturnType<typeof getInitialState> {
  get chats(): ExtendedConversation[];
  get currentChat(): ExtendedConversation | undefined;
  setHasHydrated: (v: boolean) => void;
  setUserId: (id: string) => void;
  setUserTier: (tier: "free" | "premium") => void;
  setUser: (user: User | null) => void;
  setSubscription: (sub: UserSubscription | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchAllData: (token?: string) => Promise<void>;
  updateSettings: (s: Partial<AppSettings>) => void;
  resetSettings: () => void;
  toggleTheme: () => void;
  setTheme: (theme: AppSettings["theme"]) => void;
  setAccentColor: (color: AppSettings["accentColor"]) => void;
  setLanguage: (lang: AppSettings["language"]) => void;
  setFontSize: (size: AppSettings["fontSize"]) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  createConversation: (title?: string) => Promise<ExtendedConversation>;
  createLocalConversation: (title?: string) => ExtendedConversation;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => Promise<void>;
  clearAllConversations: () => void;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePinConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  duplicateConversation: (id: string) => Promise<void>;
  pinConversation: (id: string) => void;
  unpinConversation: (id: string) => void;
  toggleFavorite: (id: string) => void;
  sendMessage: (conversationId: string | null, content: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => Promise<void>;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  getActiveConversation: () => ExtendedConversation | undefined;
  getConversationMessages: (id: string) => Message[];
  exportConversation: (id: string, format?: "json" | "txt" | "markdown") => void;
  shareConversation: (id: string) => void;
  setInputText: (text: string) => void;
  setFocusMode: (mode: FocusMode) => void;
  setWebSearchEnabled: (v: boolean) => void;
  setSelectedModel: (model: ModelOption) => void;
  setIsStreaming: (v: boolean) => void;
  setIsProcessing: (v: boolean) => void;
  setRightPanelOpen: (v: boolean) => void;
  setRightPanelTab: (tab: AppState["rightPanelTab"]) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setRoutingInfo: (info: RoutingInfo | null) => void;
  setActiveSources: (sources: Source[]) => void;
  setOrchestrationSteps: (steps: OrchestrationStep[]) => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  setLoading: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setCanvasOpen: (v: boolean) => void;
  setHistoryOpen: (v: boolean) => void;
  setSelectedPricingPlan: (planId: string | null) => void;
  setShowPricingModal: (v: boolean) => void;
  getCurrentPlan: () => PricingPlan | undefined;
  canUseFeature: (feature: string) => boolean;
  toggleFeature: (feature: keyof FeatureFlags) => void;
  resetStore: () => void;
  setWorkspaces: (workspaces: Workspace[], currentId: number) => void;
  setStorage: (used: number, total: number) => void;
  setExtensions: (count: number) => void;
  setAvailableModels: (models: ModelInfo[]) => void;
  setDraftMessage: (msg: string) => void;
  setScrollPosition: (pos: number) => void;
  setActiveTab: (tab: string) => void;
  addMemory: (text: string) => void;
  deleteMemory: (id: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...getInitialState(),
      get chats() { return get().conversations.filter(c => !c.deletedAt && !c.archived); },
      get currentChat() { return get().conversations.find(c => c.id === get().activeConversationId); },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setUserId: (id) => set({ userId: id }),
      setUserTier: (tier) => set({ userTier: tier }),
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSubscription: (sub) => set({ subscription: sub }),
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${API_BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Login failed");
          localStorage.setItem("access_token", data.access_token);
          set({ user: data.user, isAuthenticated: true, userId: data.user.id, userTier: data.tier || "free", isLoading: false });
          await get().fetchAllData();
          get().addToast({ message: "Logged in", type: "success" });
        } catch (e: any) { set({ isLoading: false }); get().addToast({ message: e.message || "Login failed", type: "error" }); throw e; }
      },
      logout: () => { localStorage.removeItem("access_token"); set({ user: null, isAuthenticated: false, userId: null, userTier: "free", conversations: [], activeConversationId: null }); get().addToast({ message: "Logged out", type: "info" }); },
      fetchAllData: async () => {
        const { user } = get(); if (!user) return; set({ isLoading: true });
        try {
          const convs = await chat.list(user);
          set({ conversations: convs.map((c: any) => ({ ...c, favorite: c.favorite || false, isPrivate: false, messages: c.messages || [], createdAt: c.createdAt || new Date().toISOString(), updatedAt: c.updatedAt || new Date().toISOString() })), isLoading: false });
        } catch {
          const ws = loadWorkspace();
          set({ conversations: ws.conversations.map((c: any) => ({ ...c, isPrivate: false, createdAt: new Date(c.createdAt).toISOString(), updatedAt: new Date(c.updatedAt).toISOString(), messages: (c.messages || []).map((m: any) => ({ ...m, createdAt: new Date(m.timestamp).toISOString() })) })), isLoading: false });
          get().addToast({ message: "Using cached data (API failed)", type: "warning" });
        }
      },
      updateSettings: (s) => {
        set((st) => ({ settings: { ...st.settings, ...s } }));
        const { theme, accentColor, fontSize } = get().settings;
        if (typeof window !== "undefined") {
          const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
          document.documentElement.classList.toggle("dark", resolved === "dark");
          if (accentColor) document.documentElement.style.setProperty("--accent-color", accentColor);
          const sm: Record<string, string> = { small: "14px", medium: "16px", large: "18px", xlarge: "20px" };
          document.documentElement.style.fontSize = typeof fontSize === "number" ? `${fontSize}px` : sm[fontSize as string] || "16px";
        }
        get().addToast({ message: "Settings updated", type: "success", duration: 2000 });
      },
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      toggleTheme: () => { const c = get().settings.theme; const cycle: Record<string, string> = { light: "dark", dark: "system", system: "light" }; get().updateSettings({ theme: cycle[c] as AppSettings["theme"] }); },
      setTheme: (theme) => get().updateSettings({ theme }),
      setAccentColor: (color) => get().updateSettings({ accentColor: color }),
      setLanguage: (lang) => get().updateSettings({ language: lang }),
      setFontSize: (size) => get().updateSettings({ fontSize: size }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      createConversation: async (title) => {
        const { user } = get(); if (!user) throw new Error("Not authenticated"); set({ isLoading: true });
        try {
          const newChat = await chat.create(title || "New Chat", user);
          const extended: ExtendedConversation = { ...newChat, favorite: false, isPrivate: false, messages: [], createdAt: newChat.createdAt || new Date().toISOString(), updatedAt: newChat.updatedAt || new Date().toISOString() };
          set((s) => ({ conversations: [extended, ...s.conversations], activeConversationId: String(extended.id), isLoading: false }));
          get().addToast({ message: "Conversation created", type: "success" }); return extended;
        } catch (e) { set({ isLoading: false }); get().addToast({ message: "Failed to create conversation", type: "error" }); throw e; }
      },
      createLocalConversation: (title) => {
        const newChat = makeChat({ title: title || "New Chat" });
        const extended: ExtendedConversation = { ...newChat, createdAt: new Date(newChat.createdAt).toISOString(), updatedAt: new Date(newChat.updatedAt).toISOString(), favorite: false, isPrivate: true, messages: [] };
        set((s) => ({ conversations: [extended, ...s.conversations], activeConversationId: String(extended.id) })); return extended;
      },
      setActiveConversation: (id) => set({ activeConversationId: id }),
      deleteConversation: async (id) => {
        const { user, conversations } = get(); const conv = conversations.find(c => c.id === id); if (!conv) return; set({ isLoading: true });
        try { if (!conv.isPrivate && user) await chat.delete(id, user); set((s) => ({ conversations: s.conversations.filter(c => c.id !== id), activeConversationId: s.activeConversationId === id ? null : s.activeConversationId, isLoading: false })); get().addToast({ message: "Conversation deleted", type: "info" }); }
        catch (e) { set({ isLoading: false }); get().addToast({ message: "Failed to delete", type: "error" }); throw e; }
      },
      clearAllConversations: () => { set({ conversations: [], activeConversationId: null }); get().addToast({ message: "All conversations cleared", type: "info" }); },
      renameConversation: async (id, newTitle) => { set((s) => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c) })); },
      togglePinConversation: async (id) => { const conv = get().conversations.find(c => c.id === id); if (conv) { if (conv.pinned) get().unpinConversation(id); else get().pinConversation(id); } },
      pinConversation: (id) => set((s) => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, pinned: true, updatedAt: new Date().toISOString() } : c) })),
      unpinConversation: (id) => set((s) => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, pinned: false, updatedAt: new Date().toISOString() } : c) })),
      toggleFavorite: (id) => set((s) => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, favorite: !c.favorite, updatedAt: new Date().toISOString() } : c) })),
      archiveConversation: async (id) => {
        const conv = get().conversations.find(c => c.id === id); if (!conv) return;
        if (!conv.isPrivate && get().user) { try { await (chat as any).archive?.(id, get().user); } catch { /* ignore */ } }
        set((s) => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, archived: true, updatedAt: new Date().toISOString() } : c) }));
        get().addToast({ message: "Conversation archived", type: "info" });
      },
      duplicateConversation: async (id) => {
        const conv = get().conversations.find(c => c.id === id); if (!conv) return;
        const newTitle = `${conv.title} (Copy)`;
        if (conv.isPrivate) { const newConv = get().createLocalConversation(newTitle); set((s) => ({ conversations: s.conversations.map(c => c.id === newConv.id ? { ...c, messages: conv.messages.map(m => ({ ...m, id: uid("msg") })) } : c) })); } else await get().createConversation(newTitle);
        get().addToast({ message: "Conversation duplicated", type: "success" });
      },
      sendMessage: async (conversationId, content) => {
        const { user, conversations } = get(); if (!user) throw new Error("Not authenticated");
        let chatId = conversationId; let conversation = conversations.find(c => c.id === chatId);
        if (!chatId) { const newConv = await get().createConversation(); chatId = String(newConv.id); conversation = newConv; }
        if (!conversation) throw new Error("Conversation not found");
        const originalMsgCount = conversation.messages.length;
        const userMsg = makeMessage({ role: "user", content }) as unknown as Message;
        const assistantMsg = makeMessage({ role: "assistant", content: "", status: "sending" }) as unknown as Message;
        set((s) => ({ conversations: s.conversations.map(c => c.id === chatId ? { ...c, messages: [...c.messages, userMsg, assistantMsg], updatedAt: new Date().toISOString() } : c) }));
        set({ isProcessing: true, isStreaming: true });
        try {
          const response = await chat.get(content, user); const reply = response.response || "";
          set((s) => ({ conversations: s.conversations.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: reply, status: "done" } : m), updatedAt: new Date().toISOString() } : c) }));
          if (originalMsgCount === 0 && conversation.title === "New Chat") await get().renameConversation(chatId!, titleFromText(content));
          set({ isProcessing: false, isStreaming: false }); get().addToast({ message: "Message sent", type: "success", duration: 2000 });
        } catch (error) {
          set((s) => ({ conversations: s.conversations.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: "⚠️ Error: " + (error as Error).message, status: "error" } : m), updatedAt: new Date().toISOString() } : c) }));
          set({ isProcessing: false, isStreaming: false }); get().addToast({ message: "Failed to send message", type: "error" }); throw error;
        }
      },
      addMessage: async (conversationId, message) => { set((s) => ({ conversations: s.conversations.map(c => c.id === conversationId ? { ...c, messages: [...c.messages, message], updatedAt: new Date().toISOString() } : c) })); },
      updateMessage: (conversationId, messageId, updates) => { set((s) => ({ conversations: s.conversations.map(c => c.id === conversationId ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, ...updates } : m), updatedAt: new Date().toISOString() } : c) })); },
      getActiveConversation: () => get().currentChat,
      getConversationMessages: (id) => get().conversations.find(c => c.id === id)?.messages || [],
      exportConversation: (id, format = "json") => {
        const conv = get().conversations.find(c => c.id === id); if (!conv) return;
        const content = format === "json" ? JSON.stringify(conv, null, 2) : format === "txt" ? conv.messages.map(m => `${m.role}: ${m.content}`).join("\n\n") : `# ${conv.title}\n\n` + conv.messages.map(m => `**${m.role}**: ${m.content}`).join("\n\n");
        const blob = new Blob([content], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${conv.title}.${format === "json" ? "json" : format === "txt" ? "txt" : "md"}`; a.click(); URL.revokeObjectURL(url);
        get().addToast({ message: `Exported as ${format}`, type: "success" });
      },
      shareConversation: (id) => { const conv = get().conversations.find(c => c.id === id); if (!conv) return; navigator.clipboard?.writeText(conv.messages.map(m => `${m.role}: ${m.content}`).join("\n\n")); get().addToast({ message: "Copied to clipboard", type: "success" }); },
      setInputText: (text) => set({ inputText: text }),
      setFocusMode: (mode) => set({ focusMode: mode }),
      setWebSearchEnabled: (v) => set({ webSearchEnabled: v }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setIsStreaming: (v) => set({ isStreaming: v }),
      setIsProcessing: (v) => set({ isProcessing: v }),
      setRightPanelOpen: (v) => set({ rightPanelOpen: v }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
      setRoutingInfo: (info) => set({ routingInfo: info }),
      setActiveSources: (sources) => set({ activeSources: sources || [] }),
      setOrchestrationSteps: (steps) => set({ orchestrationSteps: steps || [] }),
      addToast: (toast) => { const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`; set((s) => ({ toasts: [...s.toasts, { ...toast, id }] })); setTimeout(() => get().removeToast(id), toast.duration || get().settings.toastDuration || 4000); },
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
      clearToasts: () => set({ toasts: [] }),
      setLoading: (v) => set({ isLoading: v }),
      setSettingsOpen: (v) => set({ isSettingsOpen: v }),
      setCanvasOpen: (v) => set({ isCanvasOpen: v }),
      setHistoryOpen: (v) => set({ isHistoryOpen: v }),
      setSelectedPricingPlan: (planId) => set({ selectedPricingPlan: planId }),
      setShowPricingModal: (v) => set({ showPricingModal: v }),
      getCurrentPlan: () => { const { subscription } = get(); if (!subscription) return PRICING_PLANS.find(p => p.id === "free"); return PRICING_PLANS.find(p => p.id === subscription.planId) || PRICING_PLANS.find(p => p.id === "free"); },
      canUseFeature: (feature) => { const { subscription } = get(); const plan = subscription ? PRICING_PLANS.find(p => p.id === subscription.planId) : PRICING_PLANS.find(p => p.id === "free"); return plan?.features.find(f => f.label === feature)?.included ?? false; },
      toggleFeature: (feature) => set((s) => ({ featureFlags: { ...s.featureFlags, [feature]: !s.featureFlags[feature] } })),
      resetStore: () => { set({ ...getInitialState(), conversations: [], activeConversationId: null }); localStorage.removeItem("vatsa-storage"); get().addToast({ message: "Store reset", type: "info" }); },
      setWorkspaces: (workspaces, currentId) => set({ workspaces, currentWorkspaceId: currentId }),
      setStorage: (used, total) => set({ storageUsed: used, storageTotal: total }),
      setExtensions: (count) => set({ extensionsCount: count }),
      setAvailableModels: (models) => set({ availableModels: models }),
      setDraftMessage: (msg) => set({ draftMessage: msg }),
      setScrollPosition: (pos) => set({ scrollPosition: pos }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      addMemory: (text) => set((s) => ({ memories: [...s.memories, { id: uid("memory"), text, createdAt: new Date().toISOString() }] })),
      deleteMemory: (id) => set((s) => ({ memories: s.memories.filter(m => m.id !== id) })),
    }),
    {
      name: "vatsa-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => { if (state) state._hasHydrated = true; },
      partialize: (state) => ({
        user: state.user, isAuthenticated: state.isAuthenticated, userId: state.userId, userTier: state.userTier,
        subscription: state.subscription, settings: state.settings, sidebarCollapsed: state.sidebarCollapsed,
        selectedModel: state.selectedModel, focusMode: state.focusMode, webSearchEnabled: state.webSearchEnabled,
        workspaces: state.workspaces, currentWorkspaceId: state.currentWorkspaceId, storageUsed: state.storageUsed,
        storageTotal: state.storageTotal, extensionsCount: state.extensionsCount, availableModels: state.availableModels,
        conversations: state.conversations.filter(c => !c.isPrivate), activeConversationId: state.activeConversationId,
        draftMessage: state.draftMessage, scrollPosition: state.scrollPosition, activeTab: state.activeTab,
      }),
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) { const l = (persisted || {}) as Record<string, any>; return { ...l, settings: { ...DEFAULT_SETTINGS, ...l.settings }, featureFlags: getInitialState().featureFlags, workspaces: [], currentWorkspaceId: 0, storageUsed: 0, storageTotal: 0, extensionsCount: 0, availableModels: [], draftMessage: "", scrollPosition: 0, activeTab: l.activeTab || "chat" }; }
        return persisted;
      },
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────
export const useConversations = () => { const c = useAppStore(s => s.conversations); return useMemo(() => c, [c]); };
export const useActiveConversation = () => { const g = useAppStore(s => s.getActiveConversation); return useMemo(() => g(), [g]); };
export const useMessages = (conversationId: string) => { const g = useAppStore(s => s.getConversationMessages); return useMemo(() => g(conversationId), [g, conversationId]); };
export const useIsAuthenticated = () => { const a = useAppStore(s => s.isAuthenticated); return useMemo(() => a, [a]); };
export const useSettings = () => { const s = useAppStore(st => st.settings); return useMemo(() => s, [s]); };
export const useTheme = () => { const t = useAppStore(s => s.settings.theme); const a = useAppStore(s => s.settings.accentColor); return useMemo(() => ({ theme: t, accentColor: a }), [t, a]); };
export const useSettingsActions = () => { const u = useAppStore(s => s.updateSettings); const r = useAppStore(s => s.resetSettings); const tt = useAppStore(s => s.toggleTheme); const st = useAppStore(s => s.setTheme); const sa = useAppStore(s => s.setAccentColor); const sl = useAppStore(s => s.setLanguage); const sf = useAppStore(s => s.setFontSize); return useMemo(() => ({ updateSettings: u, resetSettings: r, toggleTheme: tt, setTheme: st, setAccentColor: sa, setLanguage: sl, setFontSize: sf }), [u, r, tt, st, sa, sl, sf]); };
export const useSidebarState = () => { const c = useAppStore(s => s.sidebarCollapsed); const o = useAppStore(s => s.sidebarOpen); return useMemo(() => ({ collapsed: c, open: o }), [c, o]); };
export const useChatInput = () => { const t = useAppStore(s => s.inputText); const f = useAppStore(s => s.focusMode); const w = useAppStore(s => s.webSearchEnabled); const m = useAppStore(s => s.selectedModel); const is = useAppStore(s => s.isStreaming); const ip = useAppStore(s => s.isProcessing); return useMemo(() => ({ text: t, focusMode: f, webSearch: w, model: m, isStreaming: is, isProcessing: ip }), [t, f, w, m, is, ip]); };
export const useRightPanel = () => { const o = useAppStore(s => s.rightPanelOpen); const t = useAppStore(s => s.rightPanelTab); const src = useAppStore(s => s.activeSources || []); const st = useAppStore(s => s.orchestrationSteps || []); const r = useAppStore(s => s.routingInfo); return useMemo(() => ({ open: o, tab: t, sources: src, steps: st, routing: r }), [o, t, src, st, r]); };
export const useToasts = () => { const t = useAppStore(s => s.toasts || []); return useMemo(() => t, [t]); };
export const usePricing = () => { const sub = useAppStore(s => s.subscription); const showModal = useAppStore(s => s.showPricingModal); const currentPlan = useMemo(() => sub ? PRICING_PLANS.find(p => p.id === sub.planId) || PRICING_PLANS[0] : PRICING_PLANS[0], [sub]); return useMemo(() => ({ plans: PRICING_PLANS, currentPlan, showModal }), [currentPlan, showModal]); };
export const useFeatureFlags = () => { const f = useAppStore(s => s.featureFlags); return useMemo(() => f, [f]); };
export const useUserTier = () => { const t = useAppStore(s => s.userTier); return useMemo(() => t, [t]); };
export const useWorkspace = () => { const ws = useAppStore(s => s.workspaces || []); const id = useAppStore(s => s.currentWorkspaceId); const cur = ws.find(w => w.id === id); return useMemo(() => ({ workspaces: ws, currentId: id, current: cur }), [ws, id, cur]); };
export const useStorage = () => { const u = useAppStore(s => s.storageUsed || 0); const t = useAppStore(s => s.storageTotal || 0); return useMemo(() => ({ used: u, total: t }), [u, t]); };
export const useExtensions = () => { const c = useAppStore(s => s.extensionsCount || 0); return useMemo(() => c, [c]); };
export const useAvailableModels = () => { const m = useAppStore(s => s.availableModels || []); return useMemo(() => m, [m]); };
export const useUserId = () => { const id = useAppStore(s => s.userId); return useMemo(() => id, [id]); };