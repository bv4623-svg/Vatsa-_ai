import { expect, test } from "@playwright/test";
import { fulfillSse, mockBackend } from "./mock-api";

test.describe("deep research", () => {
  test("business user gets staged progress, a cited report and sources", async ({ page }) => {
    const api = await mockBackend(page, { tier: "business" });
    api.onResearch((_b, route) =>
      fulfillSse(route, [
        { stage: "planning" },
        { stage: "searching", queries: ["solar cost 2026", "solar efficiency"] },
        { stage: "writing", source_count: 2 },
        { delta: "## Summary\nSolar is now the cheapest source [1][2]." },
        {
          done: true,
          queries: ["solar cost 2026", "solar efficiency"],
          sources: [
            { index: 1, title: "IEA solar report", url: "https://iea.org/solar", domain: "iea.org", snippet: "..." },
            { index: 2, title: "NREL efficiency chart", url: "https://nrel.gov/pv", domain: "nrel.gov", snippet: "..." },
          ],
        },
      ])
    );
    await page.goto("/home");
    await page.getByRole("button", { name: /^Deep research:/ }).click();
    await expect(page.getByRole("button", { name: /^Deep research on/ })).toHaveAttribute("aria-pressed", "true");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("How cheap is solar power now?");
    await box.press("Enter");
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await expect(page.getByText("IEA solar report").first()).toBeVisible();
    const call = api.calls.find((c) => c.path === "/api/research")!;
    expect(call.body).toMatchObject({ message: "How cheap is solar power now?" });
    expect(api.calls.find((c) => c.path === "/api/chat")).toBeUndefined();
    // Planned searches are available in the reasoning panel.
    await page.getByRole("button", { name: /Reasoning/ }).click();
    await expect(page.getByText("- solar cost 2026")).toBeVisible();
  });

  test("no sources found is explained", async ({ page }) => {
    const api = await mockBackend(page, { tier: "business" });
    api.onResearch((_b, route) =>
      fulfillSse(route, [{ stage: "planning" }, { stage: "searching", queries: ["zzqx"] }, { error: "Couldn't find any sources for this question. Try rephrasing it or making it more specific.", code: "no_sources", retryable: true }])
    );
    await page.goto("/home");
    await page.getByRole("button", { name: /^Deep research:/ }).click();
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("zzqx");
    await box.press("Enter");
    await expect(page.getByText("Couldn't find any sources").first()).toBeVisible();
  });

  test("pro user is offered the Business plan instead", async ({ page }) => {
    const api = await mockBackend(page, { tier: "pro" });
    await page.goto("/home");
    await page.getByRole("button", { name: "Deep research is a Business feature" }).click();
    await expect(page.getByText(/Deep research .* is a Business feature/)).toBeVisible();
    expect(api.calls).toHaveLength(0);
  });
});
