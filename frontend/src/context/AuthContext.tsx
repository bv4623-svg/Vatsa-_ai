// context/AuthContext.tsx
"use client";
import { createContext, useContext, useSyncExternalStore, ReactNode } from "react";
import { User } from "@/services/chat";

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  setAuthenticated: (userData: User | boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authListeners = new Set<() => void>();

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("user");
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as User;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function subscribeToAuth(listener: () => void) {
  authListeners.add(listener);
  const handleStorage = () => listener();
  window.addEventListener("storage", handleStorage);
  return () => {
    authListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function notifyAuthChanged() {
  authListeners.forEach((listener) => listener());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribeToAuth, getStoredUser, () => null);

  const login = (userData: User) => {
    localStorage.setItem("user", JSON.stringify(userData));
    notifyAuthChanged();
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    notifyAuthChanged();
  };

  const setAuthenticated = (userData: User | boolean) => {
    if (typeof userData === "boolean") return;
    login(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, setAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}