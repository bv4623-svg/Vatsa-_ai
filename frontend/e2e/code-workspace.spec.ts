import { expect, test } from "@playwright/test";
import { fulfillSse, mockBackend } from "./mock-api";

const PROJECT_REPLY = [
  "Here is your page.",
  "```html index.html",
  '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head>',
  '<body><h1 id="t">Counter</h1><script src="script.js"></script></body></html>',
  "```",
  "```css styles.css",
  "h1 { color: rgb(255, 0, 0); }",
  "```",
  "```javascript script.js",
  "document.getElementById('t').textContent = 'Counter ready';",
  "console.log('booted');",
  "let leaked = 'none'; try { leaked = String(window.localStorage.getItem('access_token')); } catch (e) { leaked = 'blocked'; }",
  "try { leaked += '|' + String(parent.document.title); } catch (e) { leaked += '|parent-blocked'; }",
  "console.log('token:' + leaked);",
  "```",
].join("\n");

test.describe("code workspace", () => {
  test("multi-file project previews with CSS/JS inlined, inside an isolated sandbox", async ({ page }) => {
    const api = await mockBackend(page, { tier: "pro" });
    api.onChat((_b, route) => fulfillSse(route, [{ delta: PROJECT_REPLY }, { done: true }]));
    await page.goto("/code");
    const box = page.locator("textarea").first();
    await box.fill("build a counter page");
    await box.press("Enter");

    const iframe = page.locator('iframe[title="Live Preview"]');
    await expect(iframe).toBeVisible();
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");

    const frame = page.frameLocator('iframe[title="Live Preview"]');
    await expect(frame.locator("#t")).toHaveText("Counter ready");
    await expect(frame.locator("#t")).toHaveCSS("color", "rgb(255, 0, 0)");

    // Console output arrives in the parent's console panel; the generated
    // code could not read the app's session token or the parent document.
    await page.getByRole("button", { name: /^Console/ }).click();
    const consolePanel = page.getByRole("region", { name: "Console output" });
    await expect(consolePanel).toContainText("booted");
    await expect(consolePanel).toContainText("token:blocked|parent-blocked");
    await expect(consolePanel).not.toContainText("e2e-token");
  });

  test("a lone JavaScript file runs and prints to the console", async ({ page }) => {
    const api = await mockBackend(page, { tier: "pro" });
    api.onChat((_b, route) =>
      fulfillSse(route, [{ delta: "```javascript app.js\nconsole.log('sum', 2 + 3);\nthrow new Error('boom');\n```" }, { done: true }])
    );
    await page.goto("/code");
    const box = page.locator("textarea").first();
    await box.fill("add two numbers in js");
    await box.press("Enter");
    const consolePanel = page.getByRole("region", { name: "Console output" });
    await expect(consolePanel).toContainText("sum 5");
    await expect(consolePanel).toContainText("boom");
    await expect(page.getByRole("button", { name: /Console, 1 errors/ })).toBeVisible();
  });
});
