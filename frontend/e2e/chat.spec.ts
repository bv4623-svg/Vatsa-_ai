import { expect, test } from "@playwright/test";
import { fulfillJson, fulfillSse, mockBackend } from "./mock-api";

const composer = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: "Message" });

test.describe("chat", () => {
  test("streams a reply", async ({ page }) => {
    const api = await mockBackend(page);
    await page.goto("/home");
    await composer(page).fill("Say hello");
    await composer(page).press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    expect(api.calls[0].body).toMatchObject({ message: "Say hello", stream: true, web_search: false });
    expect(api.calls[0].body).not.toHaveProperty("userId");
  });

  test("shows web search sources and the notice when search was skipped", async ({ page }) => {
    const api = await mockBackend(page);
    api.onChat((body, route) =>
      fulfillSse(route, [
        { notice: "Daily web search limit reached -- answered without live results. Resets at midnight UTC." },
        { delta: "Tokyo is the capital [1]." },
        { done: true, sources: [{ index: 1, title: "Tokyo - Wikipedia", url: "https://en.wikipedia.org/wiki/Tokyo", domain: "en.wikipedia.org", snippet: "Tokyo" }] },
      ])
    );
    await page.goto("/home");
    await page.getByRole("button", { name: "Web search off" }).click();
    await page.getByRole("button", { name: "Enable Search" }).click();
    await composer(page).fill("capital of Japan");
    await composer(page).press("Enter");
    await expect(page.getByRole("note")).toContainText("Daily web search limit reached");
    await expect(page.getByText("Tokyo - Wikipedia").first()).toBeVisible();
    expect(api.calls[0].body.web_search).toBe(true);
  });

  test("provider outage shows a friendly error and Try again recovers", async ({ page }) => {
    const api = await mockBackend(page);
    let attempt = 0;
    api.onChat((_b, route) => {
      attempt += 1;
      return attempt === 1
        ? fulfillSse(route, [{ error: "AI service is temporarily unavailable. Please try again.", code: "ai_unavailable", retryable: true }])
        : fulfillSse(route, [{ delta: "Recovered answer." }, { done: true }]);
    });
    await page.goto("/home");
    await composer(page).fill("hello");
    await composer(page).press("Enter");
    await expect(page.getByText("AI service is temporarily unavailable").first()).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Recovered answer.")).toBeVisible();
    // The question is shown once, not duplicated by the retry.
    await expect(page.getByText("hello", { exact: true })).toHaveCount(1);
  });

  test("HTTP errors never show raw JSON", async ({ page }) => {
    const api = await mockBackend(page);
    api.onChat((_b, route) => fulfillJson(route, { detail: { weird: "shape" } }, 500));
    await page.goto("/home");
    await composer(page).fill("hello");
    await composer(page).press("Enter");
    await expect(page.getByText("Something went wrong on our side").first()).toBeVisible();
    await expect(page.getByText("{")).toHaveCount(0);
  });

  test("daily limit opens the upgrade flow", async ({ page }) => {
    const api = await mockBackend(page, { tier: "free" });
    api.onChat((_b, route) =>
      fulfillJson(route, { detail: { error: "daily_limit_reached", feature: "chat_messages", used: 25, limit: 25 } }, 429)
    );
    await page.goto("/home");
    await composer(page).fill("hello");
    await composer(page).press("Enter");
    await expect(page.getByText("You've used all 25 free requests for today.")).toBeVisible();
  });
});

test("message actions are visible without hover on phones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "touch-screen behaviour");
  await mockBackend(page);
  await page.goto("/home");
  await composer(page).fill("hello");
  await composer(page).press("Enter");
  await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
  // Playwright counts opacity:0 as visible, so check the computed style.
  const opacity = await page.getByRole("button", { name: "Copy", exact: true }).evaluate(
    (el) => getComputedStyle(el.parentElement!.parentElement!).opacity
  );
  expect(opacity).toBe("1");
});
