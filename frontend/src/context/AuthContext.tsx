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

// useSyncExternalStore compares snapshots by reference, so parsing the JSON
// on every call would hand React a new object each time and spin forever.
// Cache against the raw string and only re-parse when it actually changes.
let cachedRaw: string | null = null;
let cachedUser: User | null = null;

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("user");
  if (stored === cachedRaw) return cachedUser;

  cachedRaw = stored;
  if (!stored) {
    cachedUser = null;
    return cachedUser;
  }

  try {
    const parsed = JSON.parse(stored) as User;
    cachedUser = parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    localStorage.removeItem("user");
    cachedRaw = null;
    cachedUser = null;
  }
  return cachedUser;
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