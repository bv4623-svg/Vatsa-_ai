import { expect, test } from "./fixtures";
import { API, fulfillJson } from "./mock-api";

/** Error bodies from the API reach people as a readable sentence: never
 * "[object Object]", a raw code, or an HTML error page. */
// Next.js mounts its own empty role="alert" route announcer on every page.
const formError = (page: import("@playwright/test").Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)');

// Sign-in is Google/GitHub only, so the password-reset form is the auth
// form left that shows API errors (same parseJsonOrThrow -> describeApiError).
async function requestResetCode(page: import("@playwright/test").Page) {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("someone@example.com");
  await page.getByRole("button", { name: "Send reset code" }).click();
}

test("validation errors are summarised, not shown as [object Object]", async ({ page }) => {
  await page.route(`${API}/auth/otp/send`, (route) =>
    fulfillJson(route, { detail: [{ loc: ["body", "email"], msg: "value is not a valid email address", type: "value_error" }] }, 422)
  );
  await requestResetCode(page);
  const alert = formError(page);
  await expect(alert).toHaveText("email: value is not a valid email address");
});

test("a proxy's HTML error page becomes a plain sentence", async ({ page }) => {
  await page.route(`${API}/auth/otp/send`, (route) =>
    route.fulfill({ status: 502, headers: { "content-type": "text/html", "access-control-allow-origin": "*" }, body: "<html><body><h1>502 Bad Gateway</h1></body></html>" })
  );
  await requestResetCode(page);
  const alert = formError(page);
  await expect(alert).toContainText("temporarily unavailable");
  await expect(alert).not.toContainText("Bad Gateway");
});

test("the server's own message is shown as-is", async ({ page }) => {
  await page.route(`${API}/auth/otp/send`, (route) => fulfillJson(route, { detail: "Too many requests. Try again in 60 seconds." }, 429));
  await requestResetCode(page);
  await expect(formError(page)).toHaveText("Too many requests. Try again in 60 seconds.");
});
