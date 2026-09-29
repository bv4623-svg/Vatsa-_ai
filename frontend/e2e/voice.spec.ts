import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { mockBackend } from "./mock-api";

/** Installs a scriptable fake SpeechRecognition + speechSynthesis. Tests
 * drive it with window.__voice.say("...") / window.__voice.fail("code"). */
async function installFakeSpeech(page: Page, opts: { recognition?: boolean } = {}) {
  await page.addInitScript(({ recognition }) => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    const spokenVoices: (string | null)[] = [];
    // Female listed first on purpose: a male label must still get the male voice.
    const voices = [
      { name: "Google UK English Female", lang: "en-GB" },
      { name: "Google UK English Male", lang: "en-GB" },
    ];
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
      speak(u: { text: string; voice?: { name: string } | null; onend?: () => void }) {
        spoken.push(u.text);
        spokenVoices.push(u.voice?.name ?? null);
        setTimeout(() => u.onend?.(), 50);
      },
      cancel() {},
      getVoices: () => voices,
      onvoiceschanged: null,
    });
    define("SpeechSynthesisUtterance", class { text: string; lang = ""; voice: unknown = null; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(t: string) { this.text = t; } });
    w.__voice = {
      spoken,
      spokenVoices,
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
  spokenVoices: () => page.evaluate(() => (window as never as { __voice: { spokenVoices: (string | null)[] } }).__voice.spokenVoices),
});

/** Settings -> Voice, opened the way a user does (Ctrl/Cmd+,). */
async function openVoiceSettings(page: Page) {
  await page.getByRole("textbox", { name: "Message" }).click();
  await page.keyboard.press("ControlOrMeta+Comma");
  await page.getByRole("button", { name: "Voice", exact: true }).click();
}

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

  test("turning voice input off in Settings hides the voice buttons", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "opened with the keyboard shortcut");
    await installFakeSpeech(page);
    await mockBackend(page, { tier: "pro" });
    await page.goto("/home");
    await expect(page.getByRole("button", { name: "Dictate with your voice" })).toBeVisible();

    await openVoiceSettings(page);
    const toggle = page.getByRole("switch", { name: "Voice input" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: "Close settings" }).click();

    await expect(page.getByRole("button", { name: "Dictate with your voice" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Voice conversation/ })).toHaveCount(0);
  });

  test("auto read speaks each new reply in the chosen voice", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "opened with the keyboard shortcut");
    await installFakeSpeech(page);
    await mockBackend(page, { tier: "pro" });
    await page.goto("/home");

    await openVoiceSettings(page);
    await page.getByLabel("Assistant voice").selectOption("Brian");
    await page.getByRole("switch", { name: "Auto read replies" }).click();
    await page.getByRole("button", { name: "Close settings" }).click();

    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("hi");
    await box.press("Enter");
    await expect(page.getByText("Hello from Vatsa.")).toBeVisible();
    await expect.poll(() => voice(page).spoken()).toEqual(["Hello from Vatsa."]);
    expect(await voice(page).spokenVoices()).toEqual(["Google UK English Male"]);
  });

  test("free plan is offered Pro", async ({ page }) => {
    await installFakeSpeech(page);
    await mockBackend(page, { tier: "free" });
    await page.goto("/home");
    await page.getByRole("button", { name: "Voice is a Pro feature" }).click();
    await expect(page.getByText(/Voice \(dictation and read-aloud\) is a Pro feature/)).toBeVisible();
  });
});
