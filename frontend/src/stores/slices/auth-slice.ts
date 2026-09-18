// Auth state slice — user, isAuthenticated, userId, userTier, subscription
import type { User, UserSubscription } from "@/types";
import type { StateCreator } from "zustand";
import { API_BASE } from "@/config/api";


export interface AuthSlice {
  _hasHydrated: boolean;
  user: User | null;
  isAuthenticated: boolean;
  userId: string | null;
  userTier: "free" | "premium";
  subscription: UserSubscription | null;
  setHasHydrated: (v: boolean) => void;
  setUserId: (id: string) => void;
  setUserTier: (tier: "free" | "premium") => void;
  setUser: (user: User | null) => void;
  setSubscription: (sub: UserSubscription | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set, get) => ({
  _hasHydrated: false,
  user: null,
  isAuthenticated: false,
  userId: null,
  userTier: "free",
  subscription: null,

  setHasHydrated: (v) => set({ _hasHydrated: v }),
  setUserId: (id) => set({ userId: id }),
  setUserTier: (tier) => set({ userTier: tier }),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSubscription: (subscription) => set({ subscription }),

  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    localStorage.setItem("access_token", data.access_token);
    set({
      user: data.user,
      isAuthenticated: true,
      userId: data.user.id,
      userTier: data.tier || "free",
    });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    set({ user: null, isAuthenticated: false, userId: null, userTier: "free" });
  },
});
