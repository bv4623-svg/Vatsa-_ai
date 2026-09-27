import { test as base, expect } from "@playwright/test";

/**
 * Every E2E test fails if the page throws an uncaught exception or leaves a
 * promise rejection unhandled: the user would see nothing, but the feature
 * is broken. Import `test`/`expect` from here instead of @playwright/test.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`${err.name}: ${err.message}${process.env.E2E_STACKS ? "\n" + err.stack : ""}`));
      await use(errors);
      expect(errors, "uncaught errors / unhandled rejections on the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
