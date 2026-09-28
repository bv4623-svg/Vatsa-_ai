import type { Page, Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API, fulfillJson, gotoSignedOut, mockBackend } from "./mock-api";

type Reply = (route: Route) => Promise<void> | void;

const form = (page: Page) => page.getByRole("form", { name: "Feedback form" });

async function captureFeedback(page: Page, reply: Reply = (route) => fulfillJson(route, { id: 1, status: "new" }, 201)) {
  const sent: Record<string, unknown>[] = [];
  await page.route(`${API}/api/feedback`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    sent.push(route.request().postDataJSON());
    return reply(route);
  });
  return sent;
}

async function openAndFill(page: Page, message = "The sidebar flickers when I resize the window.") {
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(form(page)).toBeVisible();
  await form(page).getByLabel("Type").selectOption("feature");
  await form(page).getByLabel("Message").fill(message);
  await form(page).getByRole("button", { name: "4 stars" }).click();
}

const submit = (page: Page) => form(page).getByRole("button", { name: "Send feedback" }).click();

test.describe("feedback", () => {
  test("signed in: opens, submits page + rating, shows a success toast, closes", async ({ page }) => {
    await mockBackend(page);
    const sent = await captureFeedback(page);
    await page.goto("/home");

    await openAndFill(page);
    await expect(form(page).getByLabel(/^Email/)).toHaveCount(0);
    await submit(page);

    await expect(page.getByText("Thanks! Your feedback was sent.")).toBeVisible();
    await expect(form(page)).toHaveCount(0);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "feature", message: "The sidebar flickers when I resize the window.", rating: 4 });
    expect(String(sent[0].page_url)).toMatch(/\/home$/);
  });

  test("signed out: asks for an optional email and sends it", async ({ page }) => {
    await mockBackend(page);
    const sent = await captureFeedback(page);
    await gotoSignedOut(page, "/pricing");

    await openAndFill(page);
    await form(page).getByLabel(/^Email/).fill("visitor@example.com");
    await submit(page);

    await expect(page.getByText("Thanks! Your feedback was sent.")).toBeVisible();
    expect(sent[0]).toMatchObject({ email: "visitor@example.com" });
  });

  test("a too-short message is caught before sending", async ({ page }) => {
    await mockBackend(page);
    const sent = await captureFeedback(page);
    await page.goto("/home");

    await openAndFill(page, "too short");
    await submit(page);

    await expect(form(page).getByText("Please write at least 10 characters.")).toBeVisible();
    expect(sent).toHaveLength(0);
  });

  test("the daily limit and a network failure show an error and keep the form open", async ({ page }) => {
    await mockBackend(page);
    let attempt = 0;
    await captureFeedback(page, (route) =>
      ++attempt === 1
        ? fulfillJson(route, { detail: "You can send up to 5 feedback messages a day. Thanks for all of them!" }, 429)
        : route.abort("failed"),
    );
    await page.goto("/home");

    await openAndFill(page);
    await submit(page);
    await expect(form(page).getByRole("alert")).toContainText("up to 5 feedback messages a day");

    await submit(page);
    await expect(form(page).getByRole("alert")).toContainText("Can't reach the server");
    await expect(form(page).getByLabel("Message")).toHaveValue("The sidebar flickers when I resize the window.");
  });

  test("the button is not shown on sign-in pages", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/login");
    await expect(page.getByRole("button", { name: "Send feedback" })).toHaveCount(0);
  });
});
