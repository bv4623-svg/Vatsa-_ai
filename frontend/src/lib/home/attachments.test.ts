import { describe, expect, it } from "vitest";
import {
  classifyFile, validateFile, errorMessageFromBody, documentWarning, dataUrlBytes,
  MAX_DOCUMENT_BYTES, MAX_TEXT_FILE_BYTES, MAX_IMAGE_INPUT_BYTES,
} from "./attachments";

const f = (name: string, type: string, size = 100) => ({ name, type, size });

describe("classifyFile", () => {
  it.each([
    [f("a.pdf", "application/pdf"), "document"],
    [f("A.DOCX", ""), "document"],
    [f("s.xlsx", "application/vnd.ms-excel"), "document"],
    [f("p.png", "image/png"), "image"],
    [f("p.jpg", "image/jpeg"), "image"],
    [f("p.webp", "image/webp"), "image"],
    [f("v.svg", "image/svg+xml"), "unsupported"],
    [f("h.heic", "image/heic"), "unsupported"],
    [f("main.py", ""), "text"],
    [f("data.json", "application/json"), "text"],
    [f("notes.txt", "text/plain"), "text"],
    [f("a.zip", "application/zip"), "unsupported"],
    [f("app.exe", "application/octet-stream"), "unsupported"],
    [f("deck.pptx", ""), "unsupported"],
  ])("%o -> %s", (file, kind) => {
    expect(classifyFile(file)).toBe(kind);
  });
});

describe("validateFile", () => {
  it("accepts normal files", () => {
    expect(validateFile(f("a.pdf", "application/pdf", 1000))).toBeNull();
  });
  it("rejects empty files", () => {
    expect(validateFile(f("a.txt", "text/plain", 0))).toMatch(/empty/i);
  });
  it("rejects unsupported types instead of silently dropping them", () => {
    expect(validateFile(f("a.zip", "application/zip"))).toMatch(/unsupported/i);
  });
  it("enforces per-kind size limits", () => {
    expect(validateFile(f("a.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1))).toMatch(/25 MB/);
    expect(validateFile(f("a.txt", "text/plain", MAX_TEXT_FILE_BYTES + 1))).toMatch(/2 MB/);
    expect(validateFile(f("a.png", "image/png", MAX_IMAGE_INPUT_BYTES + 1))).toMatch(/20 MB/);
  });
});

describe("errorMessageFromBody", () => {
  it("uses string details as-is", () => {
    expect(errorMessageFromBody({ detail: "This PDF is password-protected." }, 422)).toBe("This PDF is password-protected.");
  });
  it("never renders [object Object] for structured details", () => {
    expect(errorMessageFromBody({ detail: { error: "storage_limit_reached" } }, 413)).toMatch(/storage is full/);
    expect(errorMessageFromBody({ detail: { error: "upgrade_required" } }, 402)).not.toContain("object");
  });
  it("falls back by status", () => {
    expect(errorMessageFromBody(null, 401)).toMatch(/sign in/i);
    expect(errorMessageFromBody(null, 429)).toMatch(/too many/i);
    expect(errorMessageFromBody(null, 503)).toMatch(/server error/i);
    expect(errorMessageFromBody(null, 418)).toContain("418");
  });
});

describe("documentWarning", () => {
  it("prefers the server warning (e.g. scanned PDF)", () => {
    expect(documentWarning({ text: "", warning: "scanned" })).toBe("scanned");
  });
  it("describes page-capped PDFs", () => {
    expect(documentWarning({ text: "x", truncated: true, pages: 500, pages_parsed: 300 })).toBe("Only the first 300 of 500 pages were read");
  });
  it("describes char-truncated docs", () => {
    expect(documentWarning({ text: "x", truncated: true })).toMatch(/beginning/);
  });
  it("is empty for complete docs", () => {
    expect(documentWarning({ text: "x", truncated: false })).toBeUndefined();
  });
});

describe("dataUrlBytes", () => {
  it("estimates decoded size", () => {
    expect(dataUrlBytes("data:image/png;base64," + "A".repeat(400))).toBe(300);
  });
});
