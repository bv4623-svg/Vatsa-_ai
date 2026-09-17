import { API_BASE } from "@/lib/session";
import { authHeaders, parseOrThrow } from "@/lib/api-client/shared";
import type { AccountNotification } from "@/types/account";

export interface NotificationsPage {
  items: AccountNotification[];
  unreadCount: number;
}

export async function listNotifications(): Promise<NotificationsPage> {
  const res = await fetch(`${API_BASE}/api/account/notifications`, { headers: authHeaders() });
  return parseOrThrow(res);
}

export async function markNotificationRead(id: string): Promise<AccountNotification> {
  const res = await fetch(`${API_BASE}/api/account/notifications/${id}/read`, { method: "POST", headers: authHeaders() });
  return parseOrThrow(res);
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account/notifications/read-all`, { method: "POST", headers: authHeaders() });
  await parseOrThrow(res);
}
