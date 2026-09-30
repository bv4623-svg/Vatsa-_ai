import { test as base, expect } from "@playwright/test";

/** The root layout loads fonts from Google. Tests must not depend on the
 * internet: one stalled font request holds "networkidle" (gotoSignedOut)
 * until the 45 s test timeout. Answered locally with an empty stylesheet,
 * so pages fall back to system fonts; no test checks typography. */
export const GOOGLE_FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * Every E2E test fails if the page throws an uncaught exception or leaves a
 * promise rejection unhandled: the user would see nothing, but the feature
 * is broken. Import `test`/`expect` from here instead of @playwright/test.
 */
export const test = base.extend<{ pageErrors: string[]; offlineFonts: void }>({
  offlineFonts: [
    async ({ page }, use) => {
      await page.route(GOOGLE_FONTS, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
      await use();
    },
    { auto: true },
  ],
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`${err.name}: ${err.message}${process.env.E2E_STACKS ? "\n" + err.stack : ""}`));
      await use(errors);
      expect(errors, "uncaught errors / unhandled rejections on the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
