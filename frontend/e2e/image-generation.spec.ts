import { expect, test } from "./fixtures";
import { API, fulfillJson, mockBackend } from "./mock-api";

test.describe("image generation", () => {
  test("shows the loading grid, then the generated image", async ({ page }) => {
    const api = await mockBackend(page, { tier: "free" });
    const url = `${API}/api/files/${"a".repeat(32)}/preview?token=t`;
    api.onChat(async (_b, route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await fulfillJson(route, { response: `**Vatsa AI Image**\n\n![image](${url})`, image_url: url, primary_intent: "image_generation" });
    });
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("generate an image of a red fox in snow");
    await box.press("Enter");
    await expect(page.getByText(/pixels|shapes|colors|Almost|touches|details/).first()).toBeVisible();
    const img = page.getByRole("img", { name: "Generated image" });
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", url);
    // Image requests never ask for web search or reasoning.
    expect(api.calls[0].body).toMatchObject({ web_search: false, reasoning: false });
  });

  test("a non-image request that mentions drawing gets a text answer, no image loader", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("how do I draw conclusions from this data?");
    await box.press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    await expect(page.getByText(/Twinning pixels/)).toHaveCount(0);
  });

  test("provider failure shows the server's message", async ({ page }) => {
    const api = await mockBackend(page);
    api.onChat((_b, route) => fulfillJson(route, { detail: "Image generation is temporarily unavailable. Please try again." }, 502));
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("draw a cat wearing a hat");
    await box.press("Enter");
    await expect(page.getByText("Image generation is temporarily unavailable").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
