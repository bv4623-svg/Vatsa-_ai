import fs from "node:fs";
import { test } from "./fixtures";
import { fulfillSse, gotoSignedOut, mockBackend } from "./mock-api";

/** Opt-in measurement (PERF=1): per page, the JavaScript actually
 * downloaded (compressed bytes), layout shift, and main-thread long tasks
 * during load, in Chromium against the production build. Writes
 * perf-report.json; it measures, it doesn't gate. */
const PAGES = ["/", "/ (signed in)", "/pricing", "/login", "/home", "/code", "/library", "/projects"];

test("performance report", async ({ page }, info) => {
  test.skip(process.env.PERF !== "1", "set PERF=1 to measure");
  test.skip(info.project.name !== "desktop", "desktop only");
  test.setTimeout(180_000);
  const api = await mockBackend(page);
  api.onChat((_b, r) => fulfillSse(r, [{ delta: "ok" }, { done: true }]));
  await page.addInitScript(() => {
    const w = window as unknown as { __perf: { cls: number; longTasks: number[] } };
    w.__perf = { cls: 0, longTasks: [] };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__perf.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__perf.longTasks.push(e.duration); }).observe({ type: "longtask", buffered: true });
  });

  const rows = [];
  for (const path of PAGES) {
    // "/" and /login signed out: signed-in visitors are redirected by the server.
    if (path === "/" || path === "/login") await gotoSignedOut(page, path);
    else {
      await page.goto(path.replace(" (signed in)", ""));
      await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(500);
    rows.push(await page.evaluate((p) => {
      const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const js = res.filter((r) => r.name.endsWith(".js") || r.initiatorType === "script");
      const imgs = [...document.images];
      const w = window as unknown as { __perf: { cls: number; longTasks: number[] } };
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return {
        path: p,
        jsFiles: js.length,
        jsTransferKB: Math.round(js.reduce((s, r) => s + r.encodedBodySize, 0) / 1024),
        jsDecodedKB: Math.round(js.reduce((s, r) => s + r.decodedBodySize, 0) / 1024),
        cls: Number(w.__perf.cls.toFixed(3)),
        longTasks: w.__perf.longTasks.length,
        blockingMs: Math.round(w.__perf.longTasks.reduce((s, d) => s + Math.max(0, d - 50), 0)),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        imagesWithoutSize: imgs.filter((i) => !i.getAttribute("width") && !i.getAttribute("height") && !i.style.width && !i.style.height).map((i) => i.src.slice(0, 80)),
        imagesEagerBelowFold: imgs.filter((i) => i.loading !== "lazy" && i.getBoundingClientRect().top > window.innerHeight).length,
      };
    }, path));
  }
  fs.writeFileSync(process.env.PERF_OUT || "perf-report.json", JSON.stringify(rows, null, 2));
  console.table(rows.map(({ imagesWithoutSize, ...r }) => ({ ...r, imagesWithoutSize: imagesWithoutSize.length })));
});
