import { API_BASE } from "@/lib/session";
import { getToken } from "@/lib/auth";
import { coerceSettings, type UserSettings } from "@/config/settings";

/** Persists a partial settings patch to the user's profile so preferences
 * follow them across devices. Local state is updated by the caller first,
 * so a slow network never makes a toggle feel unresponsive. */
export async function saveSettings(patch: Partial<UserSettings>): Promise<UserSettings | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return coerceSettings(data?.settings);
  } catch {
    // Offline or backend down: the cookie/localStorage copy still applies.
    return null;
  }
}
