"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getToken, setToken, removeToken } from "@/lib/auth";

export interface User {
  id: number | string;
  email: string;
  full_name?: string;
  username?: string;
  tier: string;
  is_active: boolean;
  is_verified: boolean;
  profile_completed: boolean;
  settings?: Record<string, any>;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setAuth: (user: User, token: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setAuth: (user, token) => {
        setToken(token);
        set({ user, accessToken: token, isAuthenticated: true, isLoading: false, error: null });
      },

      updateUser: (updates) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...updates } });
        }
      },

      logout: () => {
        removeToken();
        set({ user: null, accessToken: null, isAuthenticated: false, error: null });
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      hydrate: async () => {
        const token = getToken();
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (res.ok) {
            const user = await res.json();
            set({ user, accessToken: token, isAuthenticated: true, isLoading: false });
          } else if (res.status === 401) {
            removeToken();
            set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "vatsa-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors for easy use
export const useUser = () => useAuthStore((s) => s.user);
export const useAccessToken = () => useAuthStore((s) => s.accessToken);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useAuthLoading = () => useAuthStore((s) => s.isLoading);
export const useAuthError = () => useAuthStore((s) => s.error);
export const useAuthActions = () => useAuthStore((s) => ({
  setAuth: s.setAuth,
  updateUser: s.updateUser,
  logout: s.logout,
  setLoading: s.setLoading,
  setError: s.setError,
  clearError: s.clearError,
  hydrate: s.hydrate,
}));
