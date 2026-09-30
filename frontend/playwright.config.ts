import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the real production build of the frontend against a
 * mocked backend: every request to E2E_API_ORIGIN is answered by
 * e2e/mock-api.ts via page.route(), so no test touches a real API, model
 * or search provider.
 *
 * Build first with the mock origin and Cloudflare's public test site key
 * (so /login and /signup render the CAPTCHA, answered by a fake in
 * e2e/fixtures.ts) inlined:
 *   NEXT_PUBLIC_API_URL=http://api.test NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npx next build && npx playwright test
 * (npm run test:e2e does both.)
 */
const PORT = Number(process.env.E2E_PORT || 3100);

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // No retries: a test that only passes on a second attempt is a bug to fix.
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
