import type { Page, Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API, fulfillJson, gotoSignedOut, mockBackend } from "./mock-api";

type Json = Record<string, unknown>;

let nextId = 100;
function review(overrides: Json = {}): Json {
  const id = nextId++;
  return {
    id, rating: 5, title: `Review ${id}`, body: `Body of review ${id}, long enough to be real.`, pros: ["Fast"], cons: [], tags: ["coding"],
    is_verified: true, is_featured: false, is_public: true, sentiment: "positive", helpful_count: 2, not_helpful_count: 0,
    created_at: "2026-09-28T10:00:00Z", edited: false, author: { id: 50 + id, name: `Author ${id}` }, replies: [],
    is_mine: false, my_vote: null, pinned: false, ...overrides,
  };
}

const stats = { count: 3, average: 4.3, distribution: { "1": 0, "2": 0, "3": 1, "4": 0, "5": 2 }, sentiment: { positive: 2, neutral: 1, negative: 0 } };

interface Call { method: string; path: string; search: URLSearchParams; body: Json | null }

/** Answers every review endpoint from the handlers given; records each call. */
async function mockReviews(page: Page, handlers: Record<string, (call: Call, route: Route) => Promise<void> | void>) {
  const calls: Call[] = [];
  await page.route((url) => /\/api\/(reviews|wall|users\/\d+\/wall|admin\/(reviews|users))/.test(url.pathname), (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fallback();
    const url = new URL(req.url());
    let body: Json | null = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    const call = { method: req.method(), path: url.pathname, search: url.searchParams, body };
    calls.push(call);
    const handler = handlers[`${call.method} ${call.path}`];
    return handler ? handler(call, route) : fulfillJson(route, { detail: `unmocked ${call.method} ${call.path}` }, 500);
  });
  return calls;
}

const summary = { stats, top_tags: [{ tag: "coding", count: 2 }], top_pros: [], top_cons: [], text: "People love the speed.", generated_by: "ai" };

test.describe("reviews wall", () => {
  test("signed out: stats, AI summary, featured shown once, sign-in prompts, load more", async ({ page }) => {
    await mockBackend(page);
    const featured = review({ is_featured: true, title: "Featured one" });
    const first = [featured, review({ title: "Second" })];
    const more = [review({ title: "Third" })];
    const calls = await mockReviews(page, {
      "GET /api/wall/public": (call, route) =>
        call.search.get("cursor") ? fulfillJson(route, { items: more, next_cursor: null }) : fulfillJson(route, { items: first, next_cursor: "c1", featured: [featured], stats }),
      "GET /api/reviews/summary": (_c, route) => fulfillJson(route, summary),
    });
    await gotoSignedOut(page, "/wall");

    await expect(page.getByText("4.3")).toBeVisible();
    await expect(page.getByText("AI summary of reviews")).toBeVisible();
    await expect(page.getByText("People love the speed.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured one" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Sign in to review" })).toHaveAttribute("href", "/login?redirect=%2Fwall");
    await expect(page.getByRole("button", { name: /^Helpful/ })).toHaveCount(0);

    // Infinite scroll: the short page puts the sentinel on screen, so page two
    // loads without a click, and the "Load more" fallback goes away with the cursor.
    await expect(page.getByRole("heading", { name: "Third" })).toBeVisible();
    expect(calls.some((c) => c.search.get("cursor") === "c1")).toBe(true);
    await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  });

  test("filters and sort go to the API; clicking a rating bar filters by rating", async ({ page }) => {
    await mockBackend(page);
    const calls = await mockReviews(page, {
      "GET /api/wall/public": (_c, route) => fulfillJson(route, { items: [review()], next_cursor: null, featured: [], stats }),
      "GET /api/reviews/summary": (_c, route) => fulfillJson(route, summary),
    });
    await page.goto("/wall");
    await expect(page.getByRole("heading", { name: /^Review \d+/ })).toBeVisible();

    await page.getByLabel("Topic").selectOption("price");
    await page.getByLabel("Sort").selectOption("helpful");
    await page.getByLabel("Verified only").check();
    await page.getByRole("button", { name: /^5 stars: 2 reviews/ }).click();
    await page.getByLabel("Search reviews").fill("python");
    await page.getByLabel("Search reviews").press("Enter");

    await expect.poll(() => calls.at(-1)?.search.toString() ?? "").toContain("q=python");
    const last = calls.filter((c) => c.path === "/api/wall/public").at(-1)!.search;
    expect(Object.fromEntries(last)).toMatchObject({ tag: "price", sort: "helpful", verified: "true", rating: "5", q: "python" });
  });

  test("signed in: vote, pin and report", async ({ page }) => {
    await mockBackend(page);
    const target = review({ title: "Vote on me", helpful_count: 2 });
    const calls = await mockReviews(page, {
      "GET /api/wall/public": (_c, route) => fulfillJson(route, { items: [target], next_cursor: null, featured: [], stats }),
      "GET /api/reviews/summary": (_c, route) => fulfillJson(route, summary),
      [`POST /api/reviews/${target.id}/vote`]: (_c, route) => fulfillJson(route, { helpful_count: 3, not_helpful_count: 0, my_vote: "helpful" }),
      [`POST /api/reviews/${target.id}/pin`]: (_c, route) => fulfillJson(route, { pinned: true, is_public: false }),
      [`POST /api/reviews/${target.id}/report`]: (_c, route) => fulfillJson(route, { reported: true }, 201),
    });
    await page.goto("/wall");
    const card = page.getByRole("article", { name: `Review by ${(target.author as Json).name}` });

    await card.getByRole("button", { name: "Helpful (2)" }).click();
    await expect(card.getByRole("button", { name: "Helpful (3)" })).toHaveAttribute("aria-pressed", "true");

    await card.getByRole("button", { name: "Pin to wall" }).click();
    await expect(card.getByRole("button", { name: "Unpin" })).toBeVisible();
    await expect(page.getByText("Pinned to your wall.")).toBeVisible();

    await card.getByRole("button", { name: "Report" }).click();
    await page.getByRole("form", { name: "Report form" }).getByLabel("Not about Vatsa AI").check();
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(card.getByRole("button", { name: "Reported" })).toBeDisabled();

    expect(calls.find((c) => c.path.endsWith("/vote"))!.body).toEqual({ vote_type: "helpful" });
    expect(calls.find((c) => c.path.endsWith("/report"))!.body).toMatchObject({ reason: "off_topic" });
  });

  test("a failed vote rolls back", async ({ page }) => {
    await mockBackend(page);
    const target = review({ helpful_count: 2 });
    await mockReviews(page, {
      "GET /api/wall/public": (_c, route) => fulfillJson(route, { items: [target], next_cursor: null, featured: [], stats }),
      "GET /api/reviews/summary": (_c, route) => fulfillJson(route, summary),
      [`POST /api/reviews/${target.id}/vote`]: (_c, route) => fulfillJson(route, { detail: "Too many attempts. Try again in a few minutes." }, 429),
    });
    await page.goto("/wall");
    await page.getByRole("button", { name: "Helpful (2)" }).click();
    await expect(page.getByText("Too many attempts")).toBeVisible();
    await expect(page.getByRole("button", { name: "Helpful (2)" })).toHaveAttribute("aria-pressed", "false");
  });

  test("writing a review: checks before sending, queued message, rejected stays open", async ({ page }) => {
    await mockBackend(page);
    let attempt = 0;
    const calls = await mockReviews(page, {
      "GET /api/wall/public": (_c, route) => fulfillJson(route, { items: [], next_cursor: null, featured: [], stats: { ...stats, count: 0, average: null } }),
      "GET /api/reviews/summary": (_c, route) => fulfillJson(route, { ...summary, text: null }),
      "POST /api/reviews": (call, route) =>
        ++attempt === 1
          ? fulfillJson(route, review({ ...call.body, status: "rejected", moderation_note: "Your review looks like spam (links, contact details or repeated text), so it wasn't published.", is_mine: true }), 201)
          : fulfillJson(route, review({ ...call.body, status: "pending", is_mine: true }), 201),
    });
    await page.goto("/wall");
    await expect(page.getByText("No reviews yet")).toBeVisible();

    await page.getByRole("button", { name: "Write a review" }).click();
    const form = page.getByRole("form", { name: "Review form" });
    await form.getByRole("button", { name: "Post review" }).click();
    await expect(form.getByText("Choose a rating from 1 to 5 stars.")).toBeVisible();
    await expect(form.getByText("Please write at least 20 characters.")).toBeVisible();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);

    await form.getByRole("radio", { name: "4 stars" }).click();
    await form.getByLabel("Your review").fill("Great for coding, visit www.example.shop for more.");
    await form.getByLabel(/^Pros/).fill("Fast\n\nAccurate");
    await form.getByRole("button", { name: "Coding" }).click();
    await form.getByRole("button", { name: "Post review" }).click();
    await expect(form.getByRole("alert")).toContainText("looks like spam");

    await form.getByLabel("Your review").fill("Great for coding and quick answers every day.");
    await form.getByRole("button", { name: "Post review" }).click();
    await expect(page.getByText("Thanks! Your review will appear once it's been checked.")).toBeVisible();
    await expect(form).toHaveCount(0);
    expect(calls.filter((c) => c.method === "POST")[1].body).toMatchObject({ rating: 4, pros: ["Fast", "Accurate"], tags: ["coding"], is_public: true });
  });
});

test.describe("my wall and user walls", () => {
  test("reorder, share publicly, unpin, and appeal a rejected review", async ({ page }) => {
    await mockBackend(page);
    const a = review({ title: "Pin A", pinned: true });
    const b = review({ title: "Pin B", pinned: true });
    const mine = review({ title: "Mine", is_mine: true, status: "rejected", moderation_note: "Off-topic.", appealed: false });
    const calls = await mockReviews(page, {
      "GET /api/wall/me": (_c, route) => fulfillJson(route, { user_id: 7, items: [
        { review_id: a.id, is_public: false, position: 0, review: a },
        { review_id: b.id, is_public: false, position: 1, review: b },
        { review_id: 9999, is_public: false, position: 2, review: null },
      ] }),
      "GET /api/reviews/mine": (_c, route) => fulfillJson(route, { items: [mine] }),
      "PUT /api/wall/me/order": (call, route) => fulfillJson(route, call.body),
      [`POST /api/reviews/${b.id}/pin`]: (call, route) => fulfillJson(route, { pinned: true, ...call.body }),
      "DELETE /api/reviews/9999/pin": (_c, route) => route.fulfill({ status: 204 }),
      [`POST /api/reviews/${mine.id}/appeal`]: (_c, route) => fulfillJson(route, { ...mine, status: "pending", appealed: true, moderation_note: "Your appeal is waiting for a moderator." }),
    });
    await page.goto("/wall/me");

    const pins = page.getByRole("list", { name: "Pinned reviews" });
    await expect(pins.getByRole("heading")).toHaveText(["Pin A", "Pin B"]);
    await expect(page.getByText("This review is no longer available.")).toBeVisible();

    await pins.getByRole("button", { name: "Move down" }).first().click();
    await expect(pins.getByRole("heading")).toHaveText(["Pin B", "Pin A"]);
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ review_ids: [b.id, a.id, 9999] });

    await pins.getByLabel("Show on my public wall").first().check();
    await expect(page.getByRole("link", { name: "View public wall" })).toHaveAttribute("href", "/users/7/wall");
    expect(calls.find((c) => c.path === `/api/reviews/${b.id}/pin`)!.body).toEqual({ is_public: true });

    await pins.getByRole("button", { name: "Unpin" }).last().click();
    await expect(page.getByText("This review is no longer available.")).toHaveCount(0);

    const own = page.getByRole("article", { name: `Review by ${(mine.author as Json).name}` });
    await expect(own.getByText("Off-topic.")).toBeVisible();
    await own.getByRole("button", { name: "Appeal" }).click();
    await own.getByLabel("Why should this review be published?").fill("It is about the product, please check again.");
    await own.getByRole("button", { name: "Send appeal" }).click();
    await expect(own.getByText("Your appeal is waiting for a moderator.")).toBeVisible();
    await expect(own.getByRole("button", { name: "Appeal" })).toHaveCount(0);
  });

  test("a user's public wall, and a missing one", async ({ page }) => {
    await mockBackend(page);
    await mockReviews(page, {
      "GET /api/users/7/wall": (_c, route) => fulfillJson(route, { user: { id: 7, name: "Priya S." }, items: [review({ title: "Shared pin" })] }),
      "GET /api/users/8/wall": (_c, route) => fulfillJson(route, { detail: "User not found" }, 404),
    });
    await gotoSignedOut(page, "/users/7/wall");
    await expect(page.getByRole("heading", { name: "Priya S.'s wall" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shared pin" })).toBeVisible();

    await gotoSignedOut(page, "/users/8/wall");
    await expect(page.getByText("This wall doesn't exist")).toBeVisible();
  });

  test("my wall needs a sign-in", async ({ page }) => {
    await mockBackend(page);
    await gotoSignedOut(page, "/wall/me");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the chat sidebar links to the reviews wall", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sidebar is a drawer on phones");
    await mockBackend(page);
    await page.goto("/home");
    await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Reviews" })).toHaveAttribute("href", "/wall");
  });
});

test.describe("review moderation", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "admin page layout is viewport-independent"));

  test("queue: approve with the PATCH body, tabs, reports and bans", async ({ page }) => {
    await mockBackend(page);
    const item = review({ title: "Needs a look", status: "pending", author_email: "who@example.com", spam_score: 0.35, report_count: 1, open_reports: [{ id: 1, reason: "spam", details: "ad", created_at: "2026-09-28T10:00:00Z" }], banned: null, appeal_message: null });
    const calls = await mockReviews(page, {
      "GET /api/admin/reviews": (call, route) =>
        fulfillJson(route, { items: call.search.get("status") === "pending" ? [item] : [], total: 1, counts: { pending: 1, approved: 5, rejected: 0, hidden: 0, open_reports: 1 } }),
      [`PATCH /api/admin/reviews/${item.id}/status`]: (call, route) => fulfillJson(route, { ...item, ...call.body }),
      [`POST /api/admin/users/${(item.author as Json).id}/ban`]: (call, route) => fulfillJson(route, { user_id: (item.author as Json).id, mode: (call.body as Json).mode }),
    });
    await page.goto("/admin/reviews");

    await expect(page.getByRole("tab", { name: "pending (1)" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("1 open report")).toBeVisible();
    const card = page.getByRole("article", { name: `Review by ${(item.author as Json).name}` });
    await expect(card.getByText(/who@example.com · spam score 0.35/)).toBeVisible();
    await expect(card.getByText('Reported: Spam or advertising · "ad"')).toBeVisible();

    await card.getByLabel("Note to the author (optional)").fill("Looks fine.");
    await card.getByRole("button", { name: "Approve" }).click();
    await expect.poll(() => calls.find((c) => c.method === "PATCH")?.body).toEqual({ status: "approved", note: "Looks fine." });

    await page.getByRole("tab", { name: "approved (5)" }).click();
    await expect.poll(() => calls.filter((c) => c.method === "GET").at(-1)?.search.get("status")).toBe("approved");
    await expect(page.getByText("Nothing approved right now.")).toBeVisible();
  });

  test("shadow-ban from the queue", async ({ page }) => {
    await mockBackend(page);
    const item = review({ status: "pending", author_email: "spam@example.com", spam_score: 0.5, report_count: 0, open_reports: [], banned: null });
    const calls = await mockReviews(page, {
      "GET /api/admin/reviews": (_c, route) => fulfillJson(route, { items: [item], total: 1, counts: { pending: 1, approved: 0, rejected: 0, hidden: 0, open_reports: 0 } }),
      [`POST /api/admin/users/${(item.author as Json).id}/ban`]: (call, route) => fulfillJson(route, { user_id: (item.author as Json).id, mode: (call.body as Json).mode }),
    });
    await page.goto("/admin/reviews");
    await page.getByRole("button", { name: "Shadow-ban author" }).click();
    await expect(page.getByText("Author shadow-banned.")).toBeVisible();
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ mode: "shadow" });
  });

  test("a non-admin sees that admin access is required", async ({ page }) => {
    await mockBackend(page);
    await mockReviews(page, { "GET /api/admin/reviews": (_c, route) => fulfillJson(route, { detail: "Admin access required" }, 403) });
    await page.goto("/admin/reviews");
    await expect(page.getByText("Admin access required")).toBeVisible();
  });
});
