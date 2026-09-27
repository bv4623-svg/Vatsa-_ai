import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { mockBackend } from "./mock-api";

/** Installs a scriptable fake SpeechRecognition + speechSynthesis. Tests
 * drive it with window.__voice.say("...") / window.__voice.fail("code"). */
async function installFakeSpeech(page: Page, opts: { recognition?: boolean } = {}) {
  await page.addInitScript(({ recognition }) => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    let active: { onstart?: () => void; onresult?: (e: unknown) => void; onerror?: (e: unknown) => void; onend?: () => void } | null = null;
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
      onstart: (() => void) | null = null; onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() { active = this as never; setTimeout(() => this.onstart?.(), 0); }
      stop() { setTimeout(() => { this.onend?.(); active = null; }, 0); }
      abort() { this.stop(); }
    }
    // defineProperty: Chromium exposes these as getter-only / built-in
    // properties that plain assignment silently fails to replace, and it
    // ships the unprefixed SpeechRecognition too.
    const define = (name: string, value: unknown) =>
      Object.defineProperty(window, name, { value, configurable: true, writable: true });
    define("SpeechRecognition", recognition ? FakeRecognition : undefined);
    define("webkitSpeechRecognition", recognition ? FakeRecognition : undefined);
    define("speechSynthesis", {
      speak(u: { text: string; onend?: () => void }) { spoken.push(u.text); setTimeout(() => u.onend?.(), 50); },
      cancel() {},
    });
    define("SpeechSynthesisUtterance", class { text: string; lang = ""; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(t: string) { this.text = t; } });
    w.__voice = {
      spoken,
      say(text: string) {
        active?.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] });
        active?.onend?.();
        active = null;
      },
      interim(text: string) {
        active?.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: text } }] });
      },
      fail(code: string) {
        active?.onerror?.({ error: code });
        active?.onend?.();
        active = null;
      },
    };
  }, { recognition: opts.recognition ?? true });
}

/** Start dictation and wait until the recogniser reported onstart, as a
 * real browser does before any result or error event. */
async function startDictation(page: Page) {
  await page.getByRole("button", { name: "Dictate with your voice" }).click();
  await expect(page.getByRole("button", { name: "Stop dictation" })).toHaveAttribute("aria-pressed", "true");
}

const voice = (page: Page) => ({
  say: (t: string) => page.evaluate((x) => (window as never as { __voice: { say(s: string): void } }).__voice.say(x), t),
  interim: (t: string) => page.evaluate((x) => (window as never as { __voice: { interim(s: string): void } }).__voice.interim(x), t),
  fail: (c: string) => page.evaluate((x) => (window as never as { __voice: { fail(s: string): void } }).__voice.fail(x), c),
  spoken: () => page.evaluate(() => (window as never as { __voice: { spoken: string[] } }).__voice.spoken),
});

test.describe("voice mode", () => {
  test("dictation fills the composer with a live transcript", async ({ page }) => {
    await installFakeSpeech(page);
    await mockBackend(page, { tier: "pro" });
    await page.goto("/home");
    await startDictation(page);
    await voice(page).interim("what is the");
    await expect(page.getByRole("status").filter({ hasText: "what is the" })).toBeVisible();
    await voice(page).say("what is the weather");
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("what is the weather");
    await expect(page.getByRole("button", { name: "Dictate with your voice" })).toBeVisible();
  });

  test("Talk mode sends the utterance and reads the reply aloud", async ({ page }) => {
    await installFakeSpeech(page);
    const api = await mockBackend(page, { tier: "pro" });
    await page.goto("/home");
    await page.getByRole("button", { name: /^Voice conversation:/ }).click();
    await startDictation(page);
    await voice(page).say("tell me a joke");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    expect(api.calls[0].body.message).toBe("tell me a joke");
    await expect.poll(() => voice(page).spoken()).toContain("Hello from Vatsa.");
  });

  test("Read aloud reads the message text", async ({ page }) => {
    await installFakeSpeech(page);
    await mockBackend(page, { tier: "pro" });
    await page.goto("/home");
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hi");
    await box.press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    await page.getByRole("button", { name: "Read aloud" }).click();
    await expect.poll(() => voice(page).spoken()).toEqual(["Hello from Vatsa."]);
  });

  test("microphone permission denied is explained", async ({ page }) => {
    await installFakeSpeech(page);
    await mockBackend(page, { tier: "pro" });
    await page.goto("/home");
    await startDictation(page);
    await voice(page).fail("not-allowed");
    await expect(page.getByRole("alert").filter({ hasText: "Microphone access is blocked" })).toBeVisible();
  });

  test("browsers without speech recognition get a disabled, explained button", async ({ page }) => {
    await installFakeSpeech(page, { recognition: false });
    await mockBackend(page, { tier: "pro" });
    await page.goto("/home");
    await expect(page.getByRole("button", { name: "Voice input isn't supported in this browser" })).toBeDisabled();
  });

  test("free plan is offered Pro", async ({ page }) => {
    await installFakeSpeech(page);
    await mockBackend(page, { tier: "free" });
    await page.goto("/home");
    await page.getByRole("button", { name: "Voice is a Pro feature" }).click();
    await expect(page.getByText(/Voice \(dictation and read-aloud\) is a Pro feature/)).toBeVisible();
  });
});
