import { expect, test } from "./fixtures";
import { API, gotoSignedOut, mockBackend } from "./mock-api";

test.describe("small app extras", () => {
  test("unknown pages get the branded 404", async ({ page }) => {
    await mockBackend(page);
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page doesn't exist" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Vatsa AI" }).first()).toHaveAttribute("src", /logo\.png/);
    await expect(page.getByRole("link", { name: "Open chat" })).toHaveAttribute("href", "/home");
  });

  test("chat messages show a relative timestamp", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hello there");
    await box.press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    await expect(page.locator("time").filter({ hasText: "just now" }).first()).toBeAttached();
  });

  test("the composer shows a character counter near the limit", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });

    await box.fill("a".repeat(1000));
    await expect(page.getByText(/\/ 200,000$/)).toHaveCount(0);

    await box.fill("a".repeat(180_000));
    await expect(page.getByText("180,000 / 200,000")).toBeVisible();

    // Same counter on the composer shown once the conversation has messages.
    await box.fill("hello there");
    await box.press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    await page.getByRole("textbox", { name: "Message" }).fill("b".repeat(200_001));
    await expect(page.getByText("200,001 / 200,000")).toBeVisible();
  });

  test("/home shows a skeleton, not a blank page, while it loads", async ({ page }) => {
    await mockBackend(page);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`${API}/api/conversations`, async (route) => {
      if (route.request().method() === "GET") await gate;
      return route.fallback();
    });

    await page.goto("/home");
    await expect(page.getByRole("status", { name: "Loading your workspace" })).toBeVisible();
    release();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading your workspace" })).toHaveCount(0);
  });

  test("the 404 is shown to signed-out visitors too", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/no-such-page");
    await expect(page.getByRole("heading", { name: "This page doesn't exist" })).toBeVisible();
  });
});
