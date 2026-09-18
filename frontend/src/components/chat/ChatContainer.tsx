import { API_BASE } from "@/config/api";
// lib/api.ts (or utils/fetch.ts)

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("access_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // optional: handle 401 globally
    if (response.status === 401) {
      // redirect to login?
    }
    throw new Error(`HTTP ${response.status}`);
  }
  return response;
}