import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API, mockBackend } from "./mock-api";

test.describe("chat and code workspaces", () => {
  test("Clear All Chats only asks the server to delete chats", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Settings opens from the sidebar; the phone sidebar is its own fix");
    await mockBackend(page);
    const deletes: string[] = [];
    await page.route((u) => u.origin === API && u.pathname === "/api/conversations", (route: Route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      deletes.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"success":true,"deleted":0}' });
    });

    await page.goto("/home");
    await page.getByRole("button", { name: "Settings", exact: true }).first().click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Clear All Chats" }).click();

    await expect.poll(() => deletes.length).toBe(1);
    expect(new URL(deletes[0]).searchParams.get("workspace")).toBe("chat");
  });
});
