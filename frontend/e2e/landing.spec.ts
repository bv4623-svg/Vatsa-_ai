import { expect, test } from "./fixtures";
import { gotoSignedOut, mockBackend } from "./mock-api";

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
