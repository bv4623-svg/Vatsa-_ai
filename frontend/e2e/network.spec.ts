import { expect, test } from "@playwright/test";
import { fulfillSse, mockBackend } from "./mock-api";

/** M-09 from TEST_REPORT (automated): slow and failing networks. The mock
 * API can't throttle bandwidth, so "slow" means a reply that takes seconds
 * to start; that is what the user experiences on a bad connection. */
test.describe("slow and failing network", () => {
  test("a slow reply shows progress and Stop cancels it", async ({ page }) => {
    const api = await mockBackend(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    api.onChat(async (_b, route) => {
      await gate; // held until the test decides
      await fulfillSse(route, [{ delta: "too late" }, { done: true }]).catch(() => {});
    });
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("slow question");
    await box.press("Enter");

    const stop = page.getByRole("button", { name: "Stop generating" });
    await expect(stop).toBeVisible();
    await expect(page.getByRole("status", { name: "Vatsa AI is responding" })).toBeVisible();
    await stop.click();
    await expect(page.getByText("Generation stopped.")).toBeVisible();
    release();
    await expect(page.getByText("too late")).toHaveCount(0);

    // The composer works again right away.
    await box.fill("next question");
    api.onChat((_b, route) => fulfillSse(route, [{ delta: "fast answer" }, { done: true }]));
    await box.press("Enter");
    await expect(page.getByText("fast answer")).toBeVisible();
  });

  test("a dropped connection is explained with a retry", async ({ page }) => {
    const api = await mockBackend(page);
    api.onChat((_b, route) => route.abort("connectionreset"));
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hello");
    await box.press("Enter");
    await expect(page.getByText("Couldn't reach Vatsa AI").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("going offline is detected", async ({ page, context }) => {
    const api = await mockBackend(page);
    await page.goto("/home");
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    // Offline = navigator.onLine false AND requests failing. (Playwright's
    // route mocks keep answering under setOffline, so fail them explicitly.)
    api.onChat((_b, route) => route.abort("internetdisconnected"));
    await context.setOffline(true);
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hello");
    await box.press("Enter");
    await expect(page.getByText("You're offline").first()).toBeVisible();
    await context.setOffline(false);
  });
});
