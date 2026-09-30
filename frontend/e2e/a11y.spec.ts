import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { fulfillSse, gotoSignedOut, mockBackend } from "./mock-api";

/** axe-core WCAG 2.1 A/AA scan of the main screens, light and dark.
 * Serious and critical violations fail the test. */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: import("@playwright/test").Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const bad = res.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${label}: ${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`);
  return bad;
}

const SCREENS = ["/", "/pricing", "/privacy", "/login", "/code", "/library", "/projects", "/scheduled", "/home"];

// One test per screen and theme: each gets its own timeout and they run in
// parallel. (A single test scanning every screen outgrew its budget on CI.)
for (const theme of ["light", "dark"] as const) {
  test.describe(`no serious accessibility violations (${theme} theme)`, () => {
    test.beforeEach(async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "one viewport is enough for axe; mobile targets are in mobile.spec.ts");
      await page.addInitScript((t) => { if (window.top === window) localStorage.setItem("vatsa-theme", t); }, theme);
    });

    for (const path of SCREENS) {
      test(path, async ({ page }) => {
        await mockBackend(page);
        // Signed-in visitors are sent on from "/" and /login, so scan those signed out.
        if (path === "/" || path === "/login") await gotoSignedOut(page, path);
        else {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
        }
        expect(await scan(page, path)).toEqual([]);
      });
    }

    test("/home with a conversation", async ({ page }) => {
      const api = await mockBackend(page);
      api.onChat((_b, r) => fulfillSse(r, [{ delta: "Answer [1]\n\n```js\nx()\n```" }, { done: true, sources: [{ index: 1, title: "Source", url: "https://example.org", domain: "example.org", snippet: "s" }] }]));
      await page.goto("/home");
      await page.getByRole("textbox", { name: "Message" }).fill("hi");
      await page.getByRole("textbox", { name: "Message" }).press("Enter");
      await page.getByText("Answer").first().waitFor();
      expect(await scan(page, "/home (conversation)")).toEqual([]);
    });
  });
}

for (const [os, app] of [["light", "dark"], ["dark", "light"]] as const) {
  test(`dark: styles follow the in-app theme (${app}), not the OS (${os})`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "one viewport is enough");
    const context = await browser.newContext({ colorScheme: os });
    const page = await context.newPage();
    await page.addInitScript((t) => { if (window.top === window) localStorage.setItem("vatsa-theme", t); }, app);
    await page.goto("/privacy");
    const color = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className = "text-gray-500 dark:text-gray-400";
      document.body.appendChild(probe);
      return getComputedStyle(probe).color;
    });
    const expected = await page.evaluate((cls) => {
      const p = document.createElement("span");
      p.style.color = cls;
      document.body.appendChild(p);
      return getComputedStyle(p).color;
    }, app === "dark" ? "var(--color-gray-400)" : "var(--color-gray-500)");
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(app === "dark");
    expect(color).toBe(expected);
    await context.close();
  });
}
