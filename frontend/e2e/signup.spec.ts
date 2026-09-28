import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API, fulfillJson, gotoSignedOut, mockBackend } from "./mock-api";

const PASSWORD = "Signup-without-code-2026";

async function fillSignup(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("Full name (optional)").fill("New Person");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("sign-up", () => {
  test("email + password creates the account and lands in the app with no emailed code", async ({ page }) => {
    await mockBackend(page);
    const registered: unknown[] = [];
    let codeRequests = 0;
    await page.route(`${API}/auth/register`, (route: Route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      registered.push(route.request().postDataJSON());
      return fulfillJson(route, {
        access_token: "e2e-signup-token",
        token_type: "bearer",
        user: { id: 7, email: "new@example.com", full_name: "New Person", tier: "free", is_verified: false },
      });
    });
    await page.route(`${API}/auth/otp/**`, (route: Route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      codeRequests++;
      return fulfillJson(route, { detail: "Email codes are only used for password reset." }, 410);
    });

    await gotoSignedOut(page, "/signup");
    await fillSignup(page, "new@example.com");

    await expect(page).toHaveURL(/\/home/);
    expect(registered).toEqual([{ email: "new@example.com", password: PASSWORD, full_name: "New Person" }]);
    expect(codeRequests).toBe(0);
    await expect(page.getByText(/verification code/i)).toHaveCount(0);
  });

  test("the sign-up page shows the real logo, not the old drawn mark", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/signup");
    const logo = page.getByRole("img", { name: "Vatsa AI" }).first();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /logo\.png/);
  });

  test("an email that already has an account is flagged on the field", async ({ page }) => {
    await mockBackend(page);
    await page.route(`${API}/auth/register`, (route: Route) =>
      route.request().method() === "OPTIONS" ? route.fallback() : fulfillJson(route, { detail: "Email already registered" }, 400),
    );

    await gotoSignedOut(page, "/signup");
    await fillSignup(page, "taken@example.com");

    await expect(page.getByText("That email already has an account. Sign in instead.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });
});
