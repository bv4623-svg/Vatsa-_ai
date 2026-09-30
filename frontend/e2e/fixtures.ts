import { test as base, expect } from "@playwright/test";

/** The root layout loads fonts from Google. Tests must not depend on the
 * internet: one stalled font request holds "networkidle" (gotoSignedOut)
 * until the 45 s test timeout. Answered locally with an empty stylesheet,
 * so pages fall back to system fonts; no test checks typography. */
export const GOOGLE_FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/** Cloudflare Turnstile (the sign-in CAPTCHA). E2E builds set Cloudflare's
 * public test site key (npm run test:e2e), so /login and /signup render the
 * widget; its script is answered with this fake, never the network.
 * window.__turnstileMode (set with addInitScript before the page loads):
 * "pass" (default) hands over a token at once, "wait" never answers (a
 * challenge not solved yet), "error" reports that it can't run. Tests can
 * also call window.__turnstileSolve(token) and window.__turnstileExpire(). */
export const TURNSTILE = /^https:\/\/challenges\.cloudflare\.com\//;
export const E2E_CAPTCHA_TOKEN = "e2e-turnstile-token";
const FAKE_TURNSTILE = `(() => {
  const widgets = {};
  let n = 0;
  window.__turnstileRendered = [];
  window.turnstile = {
    render(el, opts) {
      const id = "w" + ++n;
      widgets[id] = opts;
      window.__turnstileRendered.push({ sitekey: opts.sitekey, action: opts.action, appearance: opts.appearance });
      const mode = window.__turnstileMode || "pass";
      setTimeout(() => {
        if (!widgets[id]) return;
        if (mode === "pass") opts.callback(${JSON.stringify(E2E_CAPTCHA_TOKEN)});
        else if (mode === "error") opts["error-callback"]();
      }, 30);
      return id;
    },
    remove(id) { delete widgets[id]; },
  };
  window.__turnstileSolve = (token) => Object.values(widgets).forEach((o) => o.callback(token));
  window.__turnstileExpire = () => Object.values(widgets).forEach((o) => o["expired-callback"]());
})();`;

/**
 * Every E2E test fails if the page throws an uncaught exception or leaves a
 * promise rejection unhandled: the user would see nothing, but the feature
 * is broken. Import `test`/`expect` from here instead of @playwright/test.
 */
export const test = base.extend<{ pageErrors: string[]; offlineFonts: void; fakeTurnstile: void }>({
  offlineFonts: [
    async ({ page }, use) => {
      await page.route(GOOGLE_FONTS, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
      await use();
    },
    { auto: true },
  ],
  fakeTurnstile: [
    async ({ page }, use) => {
      await page.route(TURNSTILE, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_TURNSTILE }));
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
