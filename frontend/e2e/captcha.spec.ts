import type { Page, Request, Route } from "@playwright/test";
import { E2E_CAPTCHA_TOKEN, TURNSTILE, expect, test } from "./fixtures";
import { API, fulfillSse, gotoSignedOut, mockBackend } from "./mock-api";

/** The CAPTCHA (Cloudflare Turnstile) is on the Google/GitHub sign-in
 * buttons of /login and /signup, and nowhere else. The widget script is the
 * fake from fixtures.ts; the build carries Cloudflare's test site key. */

const TEST_SITE_KEY = "1x00000000000000000000AA";

function watchTurnstileLoads(page: Page) {
  const loads: string[] = [];
  page.on("request", (req) => {
    if (TURNSTILE.test(req.url())) loads.push(req.url());
  });
  return loads;
}

/** Captures the sign-in start the buttons submit, instead of leaving for Google. */
async function captureSignInStart(page: Page, provider: "google" | "github") {
  const starts: { method: string; url: string; body: string }[] = [];
  await page.route(`${API}/api/auth/${provider}/login`, (route: Route) => {
    const req: Request = route.request();
    starts.push({ method: req.method(), url: req.url(), body: req.postData() ?? "" });
    return route.fulfill({ status: 200, contentType: "text/html", body: "<p>provider</p>" });
  });
  return starts;
}

function setMode(page: Page, mode: "pass" | "wait" | "error") {
  return page.addInitScript((m) => {
    (window as unknown as { __turnstileMode: string }).__turnstileMode = m;
  }, mode);
}

const google = (page: Page) => page.getByRole("button", { name: "Continue with Google" });
const github = (page: Page) => page.getByRole("button", { name: "Continue with GitHub" });

test.describe("CAPTCHA on sign-in", () => {
  test("/login: the buttons wait for the check, then the token goes in the POST body", async ({ page }) => {
    await mockBackend(page);
    await setMode(page, "wait");
    const starts = await captureSignInStart(page, "google");
    await gotoSignedOut(page, "/login");

    await expect(page.getByText("Checking your browser…")).toBeVisible();
    await expect(google(page)).toBeDisabled();
    await expect(github(page)).toBeDisabled();
    const rendered = await page.evaluate(() => (window as unknown as { __turnstileRendered: unknown[] }).__turnstileRendered);
    expect(rendered).toEqual([{ sitekey: TEST_SITE_KEY, action: "login", appearance: "interaction-only" }]);

    await page.evaluate(() => (window as unknown as { __turnstileSolve: (t: string) => void }).__turnstileSolve("tok-solved"));
    await expect(google(page)).toBeEnabled();
    await google(page).click();
    await expect.poll(() => starts.length).toBe(1);
    expect(starts[0].method).toBe("POST");
    expect(starts[0].body).toBe("cf-turnstile-response=tok-solved");
    expect(starts[0].url).not.toContain("tok-solved");
  });

  test("/signup has the same check (it starts the same sign-in)", async ({ page }) => {
    await mockBackend(page);
    const starts = await captureSignInStart(page, "github");
    await gotoSignedOut(page, "/signup");
    await expect(github(page)).toBeEnabled(); // the fake passes at once
    await github(page).click();
    await expect.poll(() => starts.length).toBe(1);
    expect(starts[0]).toMatchObject({ method: "POST", body: `cf-turnstile-response=${E2E_CAPTCHA_TOKEN}` });
  });

  test("an expired token turns the buttons off until a new one arrives", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/login");
    await expect(google(page)).toBeEnabled();
    await page.evaluate(() => (window as unknown as { __turnstileExpire: () => void }).__turnstileExpire());
    await expect(google(page)).toBeDisabled();
    await expect(page.getByText("Checking your browser…")).toBeVisible();
    await page.evaluate(() => (window as unknown as { __turnstileSolve: (t: string) => void }).__turnstileSolve("tok-fresh"));
    await expect(google(page)).toBeEnabled();
  });

  test("a check that can't run is explained and nothing starts", async ({ page }) => {
    await mockBackend(page);
    await setMode(page, "error");
    await gotoSignedOut(page, "/login");
    await expect(page.getByRole("alert").filter({ hasText: "The security check couldn't load" })).toBeVisible();
    await expect(google(page)).toBeDisabled();
  });

  test("a blocked CAPTCHA script (ad blocker) is explained too", async ({ page }) => {
    await mockBackend(page);
    await page.route(TURNSTILE, (route) => route.abort("blockedbyclient"));
    await gotoSignedOut(page, "/signup");
    await expect(page.getByRole("alert").filter({ hasText: "The security check couldn't load" })).toBeVisible();
    await expect(github(page)).toBeDisabled();
  });

  test("the backend's CAPTCHA errors are explained on /login", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/login?error=captcha_failed");
    await expect(page.getByText("The security check didn't pass. Please try again.")).toBeVisible();
    await gotoSignedOut(page, "/login?error=captcha_required");
    await expect(page.getByText(/The security check didn't run/)).toBeVisible();
  });
});

test.describe("no CAPTCHA anywhere else", () => {
  test("a signed-in visitor on /login goes straight on, with no CAPTCHA", async ({ page }) => {
    await mockBackend(page);
    const loads = watchTurnstileLoads(page);
    await page.goto(`/login?redirect=${encodeURIComponent("/wall")}`);
    await expect(page).toHaveURL(/\/wall$/);
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/home$/);
    expect(loads).toEqual([]);
  });

  test("chat, the wall, settings, pricing and the landing page never load it", async ({ page }) => {
    const api = await mockBackend(page);
    api.onChat((_b, route) => fulfillSse(route, [{ delta: "Hi." }, { done: true, usage: {} }]));
    const loads = watchTurnstileLoads(page);

    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hello");
    await box.press("Enter");
    await expect(page.getByText("Hi.")).toBeVisible();
    for (const path of ["/wall", "/settings", "/pricing"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("turnstile")).toHaveCount(0);
      expect(await page.content()).not.toContain("turnstile");
    }
    await gotoSignedOut(page, "/");
    expect(await page.content()).not.toContain("turnstile");
    expect(loads).toEqual([]);
  });
});
