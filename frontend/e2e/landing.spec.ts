import { expect, test } from "./fixtures";
import { API, fulfillJson, gotoSignedOut, mockBackend } from "./mock-api";

test("rupee prices are the live ones checkout charges, not the old fixed rate", async ({ page }) => {
  await mockBackend(page);
  await page.route(`${API}/api/pricing/exchange-rate`, (route) =>
    fulfillJson(route, { usd_to_inr: 95.98, source: "live", prices_usd: { pro: 24, business: 99 }, prices_inr: { pro: 2300, business: 9500 } }),
  );
  const oldFixedRate = /1,992|8,217|₹83\b/;

  await gotoSignedOut(page, "/");
  const pricing = page.locator("#pricing");
  await pricing.scrollIntoViewIfNeeded();
  await expect(pricing.getByText("or ₹2,300 / month")).toBeVisible();
  await expect(pricing.getByText("or ₹9,500 / month")).toBeVisible();
  expect(await page.content()).not.toMatch(oldFixedRate);

  // /pricing, including the FAQ answer about cost.
  await gotoSignedOut(page, "/pricing");
  await expect(page.getByText(/or ₹2,300/)).toBeVisible();
  expect(await page.content()).not.toMatch(oldFixedRate);
});

/** Landing page interactions, as a signed-out visitor sees them. */
test("workspace cards flip from the keyboard and Launch goes somewhere", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard flow");
  await mockBackend(page);
  await gotoSignedOut(page, "/");
  const toggle = page.getByRole("button", { name: "Coding workspace: show capabilities" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Coding workspace: hide capabilities" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  const launch = page.getByRole("button", { name: "Launch Coding workspace" });
  await expect(launch).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login/);
});
