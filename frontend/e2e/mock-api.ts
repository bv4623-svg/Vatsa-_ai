import type { Page, Route } from "@playwright/test";

export const API = "http://api.test";
export const APP_ORIGIN = `http://127.0.0.1:${process.env.E2E_PORT || 3100}`;

export type Tier = "free" | "pro" | "business";

export interface ChatCall {
  path: string;
  body: Record<string, unknown>;
}

type Handler = (body: Record<string, unknown>, route: Route) => Promise<void> | void;

export interface MockApi {
  calls: ChatCall[];
  /** Override the reply for POST /api/chat (default: a two-chunk stream). */
  onChat(handler: Handler): void;
  onResearch(handler: Handler): void;
  onUpload(handler: Handler): void;
}

export const sse = (events: object[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

export function fulfillSse(route: Route, events: object[]) {
  return route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" },
    body: sse(events),
  });
}

export function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

// 1x1 PNG
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** Signs the browser in and answers every backend call from memory. */
export async function mockBackend(page: Page, opts: { tier?: Tier } = {}): Promise<MockApi> {
  const tier = opts.tier ?? "pro";
  const conversations: Record<string, { id: string; title: string; workspace: string; messages: unknown[] }> = {};
  let n = 0;
  const calls: ChatCall[] = [];
  let chatHandler: Handler = (_b, route) =>
    fulfillSse(route, [{ delta: "Hello " }, { delta: "from Vatsa." }, { done: true, usage: {} }]);
  let researchHandler: Handler = (_b, route) => fulfillJson(route, { detail: "not mocked" }, 500);
  let uploadHandler: Handler = (_b, route) => fulfillJson(route, { text: "extracted text", truncated: false, warning: null });

  // proxy.ts only lets a request into protected pages with this cookie.
  await page.context().addCookies([{ name: "vatsa_session", value: "e2e", url: APP_ORIGIN }]);
  await page.addInitScript(() => {
    // Init scripts run in every frame, including the sandboxed code preview,
    // where storage access is (correctly) refused. Only seed the app itself.
    if (window.top !== window) return;
    localStorage.setItem("access_token", "e2e-token");
    localStorage.setItem("cookie-consent", JSON.stringify({ status: "accepted", preferences: {} }));
  });

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    }
    let body: Record<string, unknown> = {};
    try {
      body = req.postDataJSON() ?? {};
    } catch {
      body = {};
    }

    if (path === "/auth/me") {
      return fulfillJson(route, { user: { id: 1, email: "e2e@example.com", full_name: "E2E User", tier, usage: {} }, id: 1, email: "e2e@example.com", tier });
    }
    if (path === "/api/conversations" && method === "GET") {
      const ws = url.searchParams.get("workspace");
      return fulfillJson(route, Object.values(conversations).filter((c) => !ws || c.workspace === ws));
    }
    if (path === "/api/conversations" && method === "POST") {
      const id = `conv_e2e${++n}`;
      conversations[id] = { id, title: String(body.title || "New Chat"), workspace: String(body.workspace || "chat"), messages: [] };
      return fulfillJson(route, { ...conversations[id], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    if (path.startsWith("/api/conversations/")) {
      const id = path.split("/")[3];
      return fulfillJson(route, conversations[id] ?? {});
    }
    if (path === "/api/chat") {
      calls.push({ path, body });
      return chatHandler(body, route);
    }
    if (path === "/api/research") {
      calls.push({ path, body });
      return researchHandler(body, route);
    }
    if (path === "/api/upload") {
      calls.push({ path, body: { multipart: true } });
      return uploadHandler(body, route);
    }
    if (path.startsWith("/api/files/")) {
      return route.fulfill({ status: 200, headers: { "content-type": "image/png", "access-control-allow-origin": "*" }, body: PNG_1PX });
    }
    // List pages, empty (the real backend always returns these shapes).
    if (path === "/api/library/items" && method === "GET") {
      return fulfillJson(route, { items: [], total: 0, page: 1, page_size: 50, has_more: false });
    }
    if (path === "/api/library/storage") {
      return fulfillJson(route, { used_bytes: 0, limit_bytes: 1073741824, breakdown: {} });
    }
    if ((path === "/api/projects" || path === "/api/account/api-keys") && method === "GET") {
      return fulfillJson(route, { items: [] });
    }
    if (path === "/api/scheduled-tasks" && method === "GET") {
      return fulfillJson(route, { items: [], total: 0, page: 1, page_size: 20, has_more: false });
    }
    // Anything else the pages load (notifications, usage, settings...).
    return fulfillJson(route, {});
  });

  return {
    calls,
    onChat: (h) => { chatHandler = h; },
    onResearch: (h) => { researchHandler = h; },
    onUpload: (h) => { uploadHandler = h; },
  };
}
