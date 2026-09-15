// frontend/src/stores/app-store-impl.ts
// Store implementation — actions and mutations. Imported by app-store.ts.
// Kept separate to stay under 100 lines per file.
import type { User } from "@/services/chat";
import type { Message, Conversation } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type ExtConv = Conversation & { favorite?: boolean; isPrivate?: boolean };

/** Auth actions builder */
export function buildAuthActions(set: any, get: any) {
  return {
    setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),
    setUserId: (id: string) => set({ userId: id }),
    setUserTier: (tier: "free" | "premium") => set({ userTier: tier }),
    setUser: (user: User | null) => set({ user, isAuthenticated: !!user }),
    setSubscription: (sub: any) => set({ subscription: sub }),
    login: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Login failed");
        localStorage.setItem("access_token", data.access_token);
        set({ user: data.user, isAuthenticated: true, userId: data.user.id, userTier: data.tier || "free", isLoading: false });
        await get().fetchAllData();
        get().addToast({ message: "Logged in", type: "success" });
      } catch (e: any) {
        set({ isLoading: false });
        get().addToast({ message: e.message || "Login failed", type: "error" });
        throw e;
      }
    },
    logout: () => {
      localStorage.removeItem("access_token");
      set({ user: null, isAuthenticated: false, userId: null, userTier: "free", conversations: [], activeConversationId: null });
      get().addToast({ message: "Logged out", type: "info" });
    },
  };
}

/** Conversation helper actions */
export function buildConvActions(set: any, get: any, chat: any, makeChat: any, makeMessage: any, titleFromText: any, uid: any, loadWorkspace: any) {
  return {
    fetchAllData: async () => {
      const { user } = get();
      if (!user) return;
      set({ isLoading: true });
      try {
        const convs = await chat.list(user);
        const extended = convs.map((c: any) => ({ ...c, favorite: c.favorite || false, isPrivate: false, messages: c.messages || [], createdAt: c.createdAt || new Date().toISOString(), updatedAt: c.updatedAt || new Date().toISOString() }));
        set({ conversations: extended, isLoading: false });
      } catch {
        const ws = loadWorkspace();
        const fallback = ws.conversations.map((c: any) => ({ ...c, isPrivate: false, createdAt: new Date(c.createdAt).toISOString(), updatedAt: new Date(c.updatedAt).toISOString(), messages: (c.messages || []).map((m: any) => ({ ...m, createdAt: new Date(m.timestamp).toISOString() })) }));
        set({ conversations: fallback, isLoading: false });
        get().addToast({ message: "Using cached data (API failed)", type: "warning" });
      }
    },

    createConversation: async (title?: string) => {
      const { user } = get();
      if (!user) throw new Error("Not authenticated");
      set({ isLoading: true });
      try {
        const newChat = await chat.create(title || "New Chat", user);
        const extended: ExtConv = { ...newChat, favorite: false, isPrivate: false, messages: [], createdAt: newChat.createdAt || new Date().toISOString(), updatedAt: newChat.updatedAt || new Date().toISOString() };
        set((s: any) => ({ conversations: [extended, ...s.conversations], activeConversationId: String(extended.id), isLoading: false }));
        get().addToast({ message: "Conversation created", type: "success" });
        return extended;
      } catch (e) {
        set({ isLoading: false });
        get().addToast({ message: "Failed to create conversation", type: "error" });
        throw e;
      }
    },

    createLocalConversation: (title?: string) => {
      const newChat = makeChat({ title: title || "New Chat" });
      const extended: ExtConv = { ...newChat, createdAt: new Date(newChat.createdAt).toISOString(), updatedAt: new Date(newChat.updatedAt).toISOString(), favorite: false, isPrivate: true, messages: [] };
      set((s: any) => ({ conversations: [extended, ...s.conversations], activeConversationId: String(extended.id) }));
      return extended;
    },

    setActiveConversation: (id: string | null) => set({ activeConversationId: id }),
    getActiveConversation: () => get().currentChat,
    getConversationMessages: (id: string) => get().conversations.find((c: any) => c.id === id)?.messages || [],
  };
}
