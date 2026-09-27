import { expect, test } from "./fixtures";
import { API, fulfillJson, mockBackend } from "./mock-api";

/** Irreversible actions ask first, and their failures are shown. */
test.describe("API keys", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "settings live in the desktop sidebar");
  });

  const key = { id: "k1", name: "CI pipeline", keyPrefix: "vk_abc", lastUsedAt: null, revoked: false, createdAt: "2026-09-01T00:00:00Z" };

  async function openApiKeys(page: import("@playwright/test").Page, onRequest: (method: string, route: import("@playwright/test").Route) => unknown) {
    await mockBackend(page, { tier: "pro" });
    await page.route(`${API}/api/account/api-keys**`, (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
      return onRequest(method, route);
    });
    await page.goto("/home");
    await page.getByRole("button", { name: "Settings", exact: true }).first().click();
    await page.getByRole("button", { name: "API Keys" }).click();
  }

  test("revoking a key needs a second, explicit click", async ({ page }) => {
    const deletes: string[] = [];
    await openApiKeys(page, (method, route) => {
      if (method === "DELETE") {
        deletes.push(route.request().url());
        return fulfillJson(route, { ok: true });
      }
      return fulfillJson(route, { items: deletes.length ? [{ ...key, revoked: true }] : [key] });
    });

    await page.getByRole("button", { name: "Revoke CI pipeline" }).click();
    const confirm = page.getByRole("group", { name: "Confirm revoking CI pipeline" });
    await expect(confirm).toContainText("Apps using it stop working");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    expect(deletes).toHaveLength(0);

    await page.getByRole("button", { name: "Revoke CI pipeline" }).click();
    await page.getByRole("button", { name: "Revoke key" }).click();
    await expect(page.getByText("vk_abc••••••• · revoked")).toBeVisible();
    expect(deletes).toEqual([`${API}/api/account/api-keys/k1`]);
  });

  test("create and revoke failures are shown, not swallowed", async ({ page }) => {
    await openApiKeys(page, (method, route) => {
      if (method === "POST") return fulfillJson(route, { detail: "Too many attempts. Try again in a few minutes." }, 429);
      if (method === "DELETE") return fulfillJson(route, { detail: { error: "internal" } }, 500);
      return fulfillJson(route, { items: [key] });
    });

    await page.getByPlaceholder("Key name (e.g. CI pipeline)").fill("Deploy bot");
    await page.getByRole("button", { name: "Create key" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Too many attempts" })).toBeVisible();

    await page.getByRole("button", { name: "Revoke CI pipeline" }).click();
    await page.getByRole("button", { name: "Revoke key" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Something went wrong on our side" })).toBeVisible();
    await expect(page.getByText("vk_abc••••••• · never used")).toBeVisible();
  });
});
