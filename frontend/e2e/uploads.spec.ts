import { expect, test } from "@playwright/test";
import { fulfillJson, mockBackend, PNG_1PX } from "./mock-api";

const PDF = Buffer.from("%PDF-1.4\n% e2e fixture\n");

async function attach(page: import("@playwright/test").Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  // The first hidden file input is the "Attach file" picker.
  await page.locator('input[type="file"]').first().setInputFiles(files);
}

test.describe("PDF and image uploads", () => {
  test("PDF text is extracted and sent inlined with the message", async ({ page }) => {
    const api = await mockBackend(page);
    api.onUpload((_b, route) => fulfillJson(route, { text: "Quarterly revenue grew 12%.", truncated: false, warning: null, pages: 1, pages_parsed: 1 }));
    await page.goto("/home");
    await attach(page, [{ name: "report.pdf", mimeType: "application/pdf", buffer: PDF }]);
    await expect(page.getByRole("group", { name: "Attachment report.pdf" })).toBeVisible();
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("Summarise this");
    await box.press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    const chat = api.calls.find((c) => c.path === "/api/chat")!;
    expect(String(chat.body.message)).toContain("--- File: report.pdf ---\nQuarterly revenue grew 12%.");
    // Text attachments are not sent a second time in the attachments array.
    expect((chat.body.attachments as { content?: string }[])[0].content).toBeUndefined();
  });

  test("scanned PDF shows the reason instead of attaching nothing", async ({ page }) => {
    const api = await mockBackend(page);
    api.onUpload((_b, route) => fulfillJson(route, { text: "", truncated: false, warning: "No selectable text found. This looks like a scanned or image-only PDF." }));
    await page.goto("/home");
    await attach(page, [{ name: "scan.pdf", mimeType: "application/pdf", buffer: PDF }]);
    await expect(page.getByRole("group", { name: /Attachment scan\.pdf, failed: No selectable text/ })).toBeVisible();
  });

  test("password-protected PDF error from the server is shown on the chip", async ({ page }) => {
    const api = await mockBackend(page);
    api.onUpload((_b, route) => fulfillJson(route, { detail: "This PDF is password-protected. Remove the password and try again." }, 422));
    await page.goto("/home");
    await attach(page, [{ name: "locked.pdf", mimeType: "application/pdf", buffer: PDF }]);
    await expect(page.getByText("This PDF is password-protected.", { exact: false })).toBeVisible();
  });

  test("storage-full upload error is readable", async ({ page }) => {
    const api = await mockBackend(page);
    api.onUpload((_b, route) => fulfillJson(route, { detail: { error: "storage_limit_reached" } }, 413));
    await page.goto("/home");
    await attach(page, [{ name: "big.pdf", mimeType: "application/pdf", buffer: PDF }]);
    await expect(page.getByText(/storage is full/)).toBeVisible();
    await expect(page.getByText("[object Object]")).toHaveCount(0);
  });

  test("unsupported and empty files are rejected before upload", async ({ page }) => {
    const api = await mockBackend(page);
    await page.goto("/home");
    await attach(page, [
      { name: "archive.zip", mimeType: "application/zip", buffer: Buffer.from("PK\x03\x04") },
      { name: "empty.txt", mimeType: "text/plain", buffer: Buffer.alloc(0) },
    ]);
    await expect(page.getByRole("group", { name: /archive\.zip, failed: Unsupported file type/ })).toBeVisible();
    await expect(page.getByRole("group", { name: /empty\.txt, failed: File is empty/ })).toBeVisible();
    expect(api.calls.filter((c) => c.path === "/api/upload")).toHaveLength(0);
  });

  test("image attachment is sent as vision input and can be removed", async ({ page }) => {
    const api = await mockBackend(page);
    await page.goto("/home");
    await attach(page, [{ name: "photo.png", mimeType: "image/png", buffer: PNG_1PX }]);
    const chip = page.getByRole("group", { name: "Attachment photo.png" });
    await expect(chip).toBeVisible();
    await expect(chip.getByRole("button", { name: "Remove photo.png" })).toBeVisible();
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("What is in this image?");
    await box.press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    const att = (api.calls[0].body.attachments as { content: string; is_base64: boolean }[])[0];
    expect(att.is_base64).toBe(true);
    expect(att.content).toMatch(/^data:image\/png;base64,/);
  });

  test("Analyze image on the free plan opens the upgrade flow", async ({ page }) => {
    await mockBackend(page, { tier: "free" });
    await page.route("http://api.test/api/vision/analyze", (route) =>
      fulfillJson(route, { detail: { error: "upgrade_required", feature: "vision", current_tier: "free", suggested_tier: "pro" } }, 402)
    );
    await page.goto("/home");
    await attach(page, [{ name: "photo.png", mimeType: "image/png", buffer: PNG_1PX }]);
    await page.getByRole("button", { name: "Analyze image photo.png" }).click();
    await expect(page.getByText(/vision is a Pro feature/i)).toBeVisible();
    await expect(page.getByText("[object Object]")).toHaveCount(0);
  });
});
