import { expect, test } from "./fixtures";
import { APP_ORIGIN, mockBackend } from "./mock-api";

/** Signed-in visitors to "/" are redirected by the server, before the
 * 2,500-line landing page is downloaded and rendered just to bounce them
 * to /home from a client effect. */
test.describe("landing page for signed-in users", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "routing is viewport-independent"));

  test("server redirects / to /home when a session cookie is present", async ({ page }) => {
    await mockBackend(page); // sets the vatsa_session cookie
    const res = await page.request.get("/?lang=de", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(new URL(res.headers()["location"], APP_ORIGIN).pathname).toBe("/home");
    expect(res.headers()["set-cookie"] ?? "").toContain("vatsa_locale=de");
  });

  test("signed-out visitors still get the landing page", async ({ page }) => {
    const res = await page.request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("<html");
  });
});
