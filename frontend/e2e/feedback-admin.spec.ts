import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { fulfillJson, mockBackend } from "./mock-api";

const ITEM = {
  id: 5,
  user_id: 12,
  email: "reporter@example.com",
  type: "bug",
  message: "Export to PDF cuts off the last page.",
  rating: 2,
  page_url: "https://vatsaai.com/library",
  user_agent: "Mozilla/5.0 Test",
  status: "new",
  created_at: "2026-09-28T09:15:00Z",
};

async function mockFeedbackApi(page: Page, list: { status?: number; items?: unknown[] } = {}) {
  const requests: { method: string; search: string; body: unknown }[] = [];
  await page.route((url) => url.pathname.startsWith("/api/feedback"), (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fallback();
    requests.push({ method: req.method(), search: new URL(req.url()).search, body: req.method() === "PATCH" ? req.postDataJSON() : null });
    if (req.method() === "PATCH") return fulfillJson(route, { ...ITEM, ...req.postDataJSON() });
    if (list.status) return fulfillJson(route, { detail: "Admin access required" }, list.status);
    const items = list.items ?? [ITEM];
    return fulfillJson(route, { items, total: items.length, limit: 200, offset: 0, counts: { new: items.length, read: 0, resolved: 0 } });
  });
  return requests;
}

test.describe("feedback admin", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "admin page layout is viewport-independent"));

  test("lists feedback and marks an item resolved", async ({ page }) => {
    await mockBackend(page);
    const requests = await mockFeedbackApi(page);
    await page.goto("/admin/feedback");

    await expect(page.getByText(ITEM.message)).toBeVisible();
    await expect(page.getByText("reporter@example.com")).toBeVisible();
    await expect(page.getByLabel("2 of 5 stars")).toBeVisible();

    await page.getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
    expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({ status: "resolved" });
  });

  test("filters by status and type", async ({ page }) => {
    await mockBackend(page);
    const requests = await mockFeedbackApi(page);
    await page.goto("/admin/feedback");
    await expect(page.getByText(ITEM.message)).toBeVisible();

    await page.getByLabel("Status").selectOption("resolved");
    await page.getByLabel("Type").selectOption("feature");
    await expect.poll(() => requests.at(-1)?.search ?? "").toContain("status=resolved");
    expect(requests.at(-1)?.search).toContain("type=feature");
  });

  test("shows an empty state", async ({ page }) => {
    await mockBackend(page);
    await mockFeedbackApi(page, { items: [] });
    await page.goto("/admin/feedback");
    await expect(page.getByText("No feedback here yet.")).toBeVisible();
  });

  test("a non-admin sees that admin access is required", async ({ page }) => {
    await mockBackend(page);
    await mockFeedbackApi(page, { status: 403 });
    await page.goto("/admin/feedback");
    await expect(page.getByText("Admin access required")).toBeVisible();
  });
});
