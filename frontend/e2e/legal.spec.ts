import { expect, test } from "./fixtures";

/** The privacy policy must describe what the code actually does. Each
 * assertion maps to verified behaviour (see BUG_FIXES.md BUG-040). */
test("privacy policy matches how data is really handled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "text content is viewport-independent");
  await page.goto("/privacy");
  const body = page.locator("body");
  // False before: uploads are kept in the Library and sent to the AI provider.
  await expect(body).not.toContainText("deleted after processing");
  await expect(body).toContainText("stored in your Library");
  // False before: nothing trains models; conversations aren't app-encrypted.
  await expect(body).not.toContainText("train models");
  await expect(body).not.toContainText("AES‑256");
  // Processors that receive user content must be disclosed.
  await expect(body).toContainText("AI model providers");
  await expect(body).toContainText("Image generation");
  await expect(body).toContainText("Web search");
  await expect(body).toContainText("speech");
  await expect(body).toContainText("GitHub");
});
