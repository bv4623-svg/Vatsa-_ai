import { expect, test } from "./fixtures";
import { API, fulfillJson, mockBackend } from "./mock-api";

/** List pages: a loading indicator while fetching, an error with a working
 * retry when the request fails, and the "nothing here yet" state only when
 * the list really is empty (never while loading or next to an error, where
 * it would read as data loss). */
const pages = [
  { path: "/library", api: "/api/library/items", empty: /Nothing here yet/, loaded: { items: [], total: 0, page: 1, page_size: 50, has_more: false } },
  { path: "/projects", api: "/api/projects", empty: /Create your first project/, loaded: { items: [] } },
  { path: "/scheduled", api: "/api/scheduled-tasks", empty: /Create your first scheduled task/, loaded: { items: [], total: 0, page: 1, page_size: 20, has_more: false } },
];

const formError = (page: import("@playwright/test").Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

for (const p of pages) {
  test.describe(p.path, () => {
    test.beforeEach(async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "state logic is viewport-independent");
      await mockBackend(page);
      await page.route(`${API}/api/library/storage`, (r) => fulfillJson(r, { used_bytes: 0, limit_bytes: 1e9, breakdown: {} }));
    });

    async function routeList(page: import("@playwright/test").Page, handler: (r: import("@playwright/test").Route) => unknown) {
      await page.route(new RegExp(`${API}${p.api}(\\?.*)?$`), (r) => {
        if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
        return handler(r);
      });
    }

    test("shows a loading indicator, not the empty state, while fetching", async ({ page }) => {
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      await routeList(page, async (r) => { await held; return fulfillJson(r, p.loaded); });
      await page.goto(p.path);
      await expect(page.getByRole("status").filter({ hasText: /Loading/ })).toBeVisible();
      await expect(page.getByText(p.empty)).toHaveCount(0);
      release();
      await expect(page.getByText(p.empty).first()).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: /Loading/ })).toHaveCount(0);
    });

    test("a failed load shows the error with a retry, without the empty state", async ({ page }) => {
      let fail = true;
      await routeList(page, (r) => (fail ? fulfillJson(r, { detail: "Database is down" }, 500) : fulfillJson(r, p.loaded)));
      await page.goto(p.path);
      await expect(formError(page)).toContainText("Database is down");
      await expect(page.getByText(p.empty)).toHaveCount(0);
      fail = false;
      await formError(page).getByRole("button", { name: "Try again" }).click();
      await expect(formError(page)).toHaveCount(0);
      await expect(page.getByText(p.empty).first()).toBeVisible();
    });
  });
}
