import { useAuthStore, type User as AuthUser } from "@/stores/auth";
import { useAppStore } from "@/stores/app-store";
import { setToken, removeToken, getToken } from "@/lib/auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/** Mirrors session presence into a cookie so proxy.ts can protect private
 * routes before React runs. The bearer token in localStorage stays the
 * authority -- the backend re-validates the JWT on every request, so this
 * cookie only decides "show the page or bounce to /login". */
const SESSION_COOKIE = "vatsa_session";

function writeSessionCookie(token: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // 7 days, matching ACCESS_TOKEN_EXPIRE_MINUTES on the backend.
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function normalizeTier(raw: unknown): "free" | "pro" | "ultra" {
  const t = String(raw ?? "free").toLowerCase();
  if (t === "ultra") return "ultra";
  if (t === "pro" || t === "paid" || t === "premium") return "pro";
  return "free";
}

/**
 * The app keeps two Zustand stores that both hold "the logged-in user":
 * stores/auth.ts (code workspace) and stores/app-store.ts (chat, pricing,
 * landing, profile menu). Writing only one of them is what made a
 * logged-in user look logged out on /pricing. Every sign-in path must go
 * through here so both stores and the token always agree.
 */
export function establishSession(user: any, token: string) {
  setToken(token);
  writeSessionCookie(token);

  useAuthStore.getState().setAuth(user as AuthUser, token);

  const app = useAppStore.getState();
  app.setUser(user);
  if (user?.id != null) app.setUserId(String(user.id));
  app.setUserTier(normalizeTier(user?.tier));

  syncAuthContext(user);
}

export function clearSession() {
  removeToken();
  clearSessionCookie();
  useAuthStore.getState().logout();
  useAppStore.setState({
    user: null,
    isAuthenticated: false,
    userId: null,
    userTier: "free",
    conversations: [],
    activeConversationId: null,
  });

  syncAuthContext(null);
}

/** context/AuthContext.tsx reads a plain "user" localStorage key and only
 * re-renders on a storage event, so keep it in step with the stores. */
function syncAuthContext(user: any | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
    window.dispatchEvent(new StorageEvent("storage", { key: "user" }));
  } catch {
    // Private-mode / quota failures must not break sign-in.
  }
}

/**
 * Restores the session on a cold page load from the stored token, so a
 * user who lands directly on /pricing (or any other entry point) is
 * recognised without having to pass through /home first.
 * Returns the user, or null when there is no valid session.
 */
export async function bootstrapSession(): Promise<any | null> {
  const token = getToken();
  if (!token) {
    clearSessionCookie();
    useAuthStore.setState({ isLoading: false });
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      clearSession();
      useAuthStore.setState({ isLoading: false });
      return null;
    }

    if (!res.ok) {
      // Backend down or erroring: keep whatever was persisted rather than
      // signing the user out over a transient failure.
      useAuthStore.setState({ isLoading: false });
      return null;
    }

    const user = await res.json();

    // The user may have signed out while /auth/me was in flight (the
    // /logout route clears the session on mount, racing this request).
    // Re-establishing here would silently sign them back in.
    if (getToken() !== token) {
      useAuthStore.setState({ isLoading: false });
      return null;
    }

    establishSession(user, token);
    useAuthStore.setState({ isLoading: false });
    return user;
  } catch {
    useAuthStore.setState({ isLoading: false });
    return null;
  }
}
