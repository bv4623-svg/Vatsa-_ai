import { expect, test } from "./fixtures";
import { fulfillSse, gotoSignedOut, mockBackend } from "./mock-api";

/** Touch-screen quality on a phone (Pixel 7 project only). */
test.describe("mobile", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile", "phone-only checks"));

  test("no page scrolls sideways", async ({ page }) => {
    await mockBackend(page);
    for (const path of ["/", "/pricing", "/privacy", "/home", "/code"]) {
      if (path === "/") await gotoSignedOut(page, path);
      else {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
      }
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw, `${path} overflows horizontally`).toBeLessThanOrEqual(cw);
    }
  });

  test("every chat control is at least 44x44 and has an accessible name", async ({ page }) => {
    const api = await mockBackend(page);
    api.onChat((_b, r) => fulfillSse(r, [{ delta: "Answer:\n\n```js\nx()\n```" }, { done: true }]));
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hi");
    await box.press("Enter");
    await page.getByText("Answer:").waitFor();
    const problems = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll("main button, main a[href], main [role=button]"))) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (!r.width || !r.height || s.visibility === "hidden" || s.display === "none") continue;
        const name = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || "").trim();
        if (!name) out.push(`unnamed ${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
        if (r.width < 44 || r.height < 44) out.push(`${Math.round(r.width)}x${Math.round(r.height)} ${name.slice(0, 40)}`);
      }
      return out;
    });
    expect(problems).toEqual([]);
  });

  test("keyboard and notch aware: viewport resizes with the keyboard, safe areas respected", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/home");
    const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
    // Chrome for Android only keeps a bottom composer above the on-screen
    // keyboard when the layout viewport resizes with it.
    expect(meta).toContain("interactive-widget=resizes-content");
    // Lets env(safe-area-inset-*) report the iPhone home-indicator inset.
    expect(meta).toContain("viewport-fit=cover");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hi");
    await box.press("Enter");
    const shell = await page.evaluate(() => {
      const el = document.querySelector("[data-chat-shell]") as HTMLElement | null;
      return el ? { h: el.getBoundingClientRect().height, vh: window.innerHeight } : null;
    });
    expect(shell, "chat shell marked with data-chat-shell").not.toBeNull();
    expect(Math.round(shell!.h)).toBe(shell!.vh);
  });
});

