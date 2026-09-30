import type { Page, Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API, fulfillJson, fulfillSse, mockBackend } from "./mock-api";

/** 👍/👎 on replies are saved (Phase 0 Fix 3): against the id the server
 * stored the reply under, back after a reload, with an optional reason on
 * 👎; plus the admin page at /admin/chat-feedback. */

const CONV = "conv_saved1";
const REPLY = "msg_saved1";

type Call = { method: string; body?: Record<string, unknown>; query?: Record<string, string> };

/** A stateful stand-in for /api/chat/feedback: remembers votes, so a
 * reload really reads back what was saved. */
async function feedbackBackend(page: Page, opts: { failSaves?: boolean } = {}) {
  const votes = new Map<string, { rating: string; reason: string | null }>();
  const calls: Call[] = [];
  await page.route((url) => url.origin === API && url.pathname === "/api/chat/feedback", (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const query = Object.fromEntries(url.searchParams);
    if (req.method() === "OPTIONS") return route.fallback();
    if (req.method() === "GET") {
      const items = [...votes].map(([message_id, v]) => ({ conversation_id: query.conversation_id, message_id, ...v }));
      return fulfillJson(route, { items });
    }
    if (req.method() === "DELETE") {
      calls.push({ method: "DELETE", query });
      votes.delete(query.message_id);
      return fulfillJson(route, { ...query, rating: null, reason: null });
    }
    const body = req.postDataJSON();
    calls.push({ method: "POST", body });
    if (opts.failSaves) return fulfillJson(route, { detail: "Database unavailable" }, 500);
    const saved = { rating: body.rating, reason: body.rating === "down" ? body.reason : null };
    votes.set(body.message_id, saved);
    return fulfillJson(route, { conversation_id: body.conversation_id, message_id: body.message_id, ...saved });
  });
  return { calls, votes };
}

/** A conversation the server already has, with one saved reply. */
async function savedConversation(page: Page) {
  const conv = {
    id: CONV, title: "Saved chat", workspace: "chat",
    messages: [
      { id: "msg_user1", role: "user", content: "What is 2+2?", createdAt: "2026-09-30T08:00:00Z" },
      { id: REPLY, role: "assistant", content: "It is 4.", createdAt: "2026-09-30T08:00:01Z" },
    ],
    createdAt: "2026-09-30T08:00:00Z", updatedAt: "2026-09-30T08:00:01Z",
  };
  await page.route((url) => url.origin === API && url.pathname === "/api/conversations", (route: Route) =>
    route.request().method() === "GET" ? fulfillJson(route, [conv]) : route.fallback(),
  );
  await page.route((url) => url.origin === API && url.pathname === `/api/conversations/${CONV}`, (route: Route) =>
    route.request().method() === "GET" ? fulfillJson(route, conv) : route.fallback(),
  );
}

const good = (page: Page) => page.getByRole("button", { name: "Good response" });
const bad = (page: Page) => page.getByRole("button", { name: "Bad response" });

test.describe("rating replies", () => {
  test("a 👍 is saved against the stored reply and is still there after a reload", async ({ page }) => {
    await mockBackend(page);
    await savedConversation(page);
    const fb = await feedbackBackend(page);
    await page.goto("/home");
    await expect(page.getByText("It is 4.")).toBeVisible();

    await good(page).click();
    await expect(good(page)).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => fb.calls.length).toBe(1);
    expect(fb.calls[0]).toEqual({ method: "POST", body: { conversation_id: CONV, message_id: REPLY, rating: "up", reason: null } });

    await page.reload();
    await expect(page.getByText("It is 4.")).toBeVisible();
    await expect(good(page)).toHaveAttribute("aria-pressed", "true");
    await expect(bad(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("a new reply is rated by the id the server saved it under", async ({ page }) => {
    const api = await mockBackend(page);
    api.onChat((_b, route) => fulfillSse(route, [{ delta: "Fresh answer." }, { done: true, usage: {}, message_id: "msg_new1" }]));
    const fb = await feedbackBackend(page);
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hello");
    await box.press("Enter");
    await expect(page.getByText("Fresh answer.")).toBeVisible();

    await good(page).last().click();
    await expect.poll(() => fb.calls.length).toBe(1);
    const chat = api.calls.find((c) => c.path === "/api/chat")!;
    expect(fb.calls[0].body).toMatchObject({ message_id: "msg_new1", conversation_id: chat.body.conversation_id, rating: "up" });
  });

  test("👎 asks what went wrong, saves the reason, and a second click clears the vote", async ({ page }) => {
    await mockBackend(page);
    await savedConversation(page);
    const fb = await feedbackBackend(page);
    await page.goto("/home");
    await expect(page.getByText("It is 4.")).toBeVisible();

    await bad(page).click();
    const reasons = page.getByRole("group", { name: "What went wrong?" });
    await expect(reasons).toBeVisible();
    await reasons.getByRole("button", { name: "Too long" }).click();
    await expect(reasons.getByRole("button", { name: "Too long" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => fb.calls.length).toBe(2);
    expect(fb.calls[1].body).toEqual({ conversation_id: CONV, message_id: REPLY, rating: "down", reason: "too_long" });

    await bad(page).click();
    await expect(reasons).toHaveCount(0);
    await expect.poll(() => fb.calls.length).toBe(3);
    expect(fb.calls[2]).toEqual({ method: "DELETE", query: { conversation_id: CONV, message_id: REPLY } });
  });

  test("a vote that can't be saved is undone and explained", async ({ page }) => {
    await mockBackend(page);
    await savedConversation(page);
    await feedbackBackend(page, { failSaves: true });
    await page.goto("/home");
    await expect(page.getByText("It is 4.")).toBeVisible();

    await good(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't save your rating. Try again." })).toBeVisible();
    await expect(good(page)).toHaveAttribute("aria-pressed", "false");
  });
});

const STATS = {
  days: 30, total: 17, up: 12, down: 5, satisfaction: 0.706,
  by_day: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
    up: i === 29 ? 7 : i === 27 ? 5 : 0,
    down: i === 29 ? 2 : i === 28 ? 3 : 0,
  })),
  top_reasons: [{ reason: "too_long", count: 3 }, { reason: "wrong", count: 1 }],
  down_without_reason: 1,
};

test.describe("admin: chat ratings", () => {
  test("totals, the daily chart with a table view, and the reasons", async ({ page }) => {
    await mockBackend(page);
    const asked: string[] = [];
    await page.route(`${API}/api/admin/chat-feedback/stats**`, (route: Route) => {
      asked.push(new URL(route.request().url()).searchParams.get("days") ?? "");
      return fulfillJson(route, STATS);
    });
    await page.goto("/admin/chat-feedback");

    await expect(page.getByRole("heading", { name: "Chat ratings" })).toBeVisible();
    await expect(page.getByText("Helpful share")).toBeVisible();
    await expect(page.getByText("71%")).toBeVisible();
    await expect(page.getByRole("img", { name: "Ratings per day over 30 days: 12 helpful, 5 not helpful" })).toBeVisible();

    await page.getByTestId("rating-day").last().hover();
    await expect(page.getByRole("status").filter({ hasText: "7 helpful · 2 not helpful" })).toBeVisible();

    await page.getByText("Show as a table").click();
    await expect(page.getByRole("row")).not.toHaveCount(0);
    const reasons = page.getByRole("region", { name: "Why replies were rated 👎" });
    await expect(reasons.getByRole("row", { name: /Too long 3 60%/ })).toBeVisible();
    await expect(reasons.getByRole("row", { name: /No reason given 1 20%/ })).toBeVisible();

    await page.getByLabel("Period").selectOption("7");
    await expect.poll(() => asked).toEqual(["30", "7"]);
  });

  test("someone who isn't an admin is told so", async ({ page }) => {
    await mockBackend(page);
    await page.route(`${API}/api/admin/chat-feedback/stats**`, (route: Route) => fulfillJson(route, { detail: "Admin access required" }, 403));
    await page.goto("/admin/chat-feedback");
    await expect(page.getByRole("alert").filter({ hasText: "Admin access required" })).toBeVisible();
  });
});
