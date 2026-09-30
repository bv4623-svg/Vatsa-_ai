import type { Page, Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API, APP_ORIGIN, fulfillJson, gotoSignedOut, mockBackend } from "./mock-api";

/** Stands in for the provider round trip: the backend's /login redirect
 * comes straight back to /auth/callback with a token, as the real one does
 * after Google/GitHub approve. */
async function providerApproves(page: Page, provider: "google" | "github") {
  await page.route(`${API}/api/auth/${provider}/login`, (route: Route) =>
    route.fulfill({
      status: 302,
      headers: { location: `${APP_ORIGIN}/auth/callback?access_token=e2e-token&email=new%40example.com&tier=free&profile_completed=true` },
    }),
  );
  await page.route(`${APP_ORIGIN}/api/auth/me`, (route: Route) =>
    fulfillJson(route, { id: 7, email: "new@example.com", full_name: "New Person", tier: "free", profile_completed: true }),
  );
}

test.describe("sign-up", () => {
  test("offers Google and GitHub only: no email, password or Microsoft", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByText(/microsoft/i)).toHaveCount(0);
  });

  test("the sign-up page shows the real logo, not the old drawn mark", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/signup");
    const logo = page.getByRole("img", { name: "Vatsa AI" }).first();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /logo\.png/);
  });

  test("signing up for a paid plan with Google continues to checkout", async ({ page }) => {
    await mockBackend(page);
    await providerApproves(page, "google");
    await gotoSignedOut(page, "/signup?plan=pro");
    await expect(page.getByText("You'll continue to checkout for the pro plan after signing up.")).toBeVisible();
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(`${APP_ORIGIN}/checkout?plan=pro`);
  });

  test("signing up for free with GitHub lands in the app", async ({ page }) => {
    await mockBackend(page);
    await providerApproves(page, "github");
    await gotoSignedOut(page, "/signup?plan=free");
    await page.getByRole("button", { name: "Continue with GitHub" }).click();
    await expect(page).toHaveURL(`${APP_ORIGIN}/home`);
  });
});

test.describe("sign-in keeps its destination across Google/GitHub", () => {
  test("upgrading from pricing while signed out ends at checkout", async ({ page }) => {
    await mockBackend(page);
    await providerApproves(page, "github");
    await gotoSignedOut(page, `/login?redirect=${encodeURIComponent("/checkout?plan=business")}`);
    await page.getByRole("button", { name: "Continue with GitHub" }).click();
    await expect(page).toHaveURL(`${APP_ORIGIN}/checkout?plan=business`);
  });

  test("with 2FA on, the code is asked for before there is any session", async ({ page }) => {
    await mockBackend(page);
    await page.route(`${API}/api/auth/google/login`, (route: Route) =>
      route.fulfill({ status: 302, headers: { location: `${APP_ORIGIN}/auth/callback?requires_2fa=true&pending_token=e2e-pending` } }),
    );
    const attempts: unknown[] = [];
    await page.route(`${API}/auth/2fa/verify-login`, (route: Route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      const body = route.request().postDataJSON();
      attempts.push(body);
      return body.code === "246810"
        ? fulfillJson(route, { access_token: "e2e-token", token_type: "bearer", user: { id: 7, email: "admin@example.com", tier: "pro" } })
        : fulfillJson(route, { detail: "Invalid code" }, 400);
    });
    let meCalls = 0;
    await page.route(`${APP_ORIGIN}/api/auth/me`, (route: Route) => {
      meCalls++;
      return fulfillJson(route, { id: 7, email: "admin@example.com", tier: "pro", profile_completed: true });
    });

    await gotoSignedOut(page, `/login?redirect=${encodeURIComponent("/checkout?plan=pro")}`);
    await page.getByRole("button", { name: "Continue with Google" }).click();

    const codeBox = page.getByLabel("Authentication code");
    await expect(codeBox).toBeVisible();
    expect(meCalls).toBe(0);
    await codeBox.fill("111111");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid code" })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/callback/);

    await codeBox.fill("246810");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(`${APP_ORIGIN}/checkout?plan=pro`);
    expect(attempts).toEqual([
      { pending_token: "e2e-pending", code: "111111" },
      { pending_token: "e2e-pending", code: "246810" },
    ]);
  });

  test("an off-site redirect is ignored", async ({ page }) => {
    await mockBackend(page);
    await providerApproves(page, "google");
    await gotoSignedOut(page, `/login?redirect=${encodeURIComponent("//evil.example/")}`);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(`${APP_ORIGIN}/home`);
  });
});
