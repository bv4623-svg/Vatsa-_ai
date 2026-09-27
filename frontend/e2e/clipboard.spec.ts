import { expect, test } from "./fixtures";
import { fulfillSse, mockBackend } from "./mock-api";

const REPLY = "Here you go:\n\n```python\nprint('hello')\n```";

test.describe("copy to clipboard", () => {
  test("copying a code block puts the code on the clipboard", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "clipboard permissions are per-context; one run is enough");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const api = await mockBackend(page);
    api.onChat((_b, route) => fulfillSse(route, [{ delta: REPLY }, { done: true }]));
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("python hello");
    await box.press("Enter");
    await page.getByRole("button", { name: "Copy code" }).click();
    await expect(page.getByRole("button", { name: "Copied" }).first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("print('hello')");
  });

  test("when the clipboard is blocked, copy fails visibly without breaking the page", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one run is enough");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")), readText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
        configurable: true,
      });
    });
    const api = await mockBackend(page);
    api.onChat((_b, route) => fulfillSse(route, [{ delta: REPLY }, { done: true }]));
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("python hello");
    await box.press("Enter");
    await page.getByRole("button", { name: "Copy code" }).click();
    await expect(page.getByRole("button", { name: "Copy failed" }).first()).toBeVisible();
    // The fixture fails the test on any unhandled rejection.
  });
});
