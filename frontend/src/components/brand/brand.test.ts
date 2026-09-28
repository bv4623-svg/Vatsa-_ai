import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("brand logo", () => {
  it("AIIcon, used across the app shell, renders the real logo.png", () => {
    const src = read("src/components/brand/AIIcon.tsx");
    expect(src).toContain('src="/logo.png"');
    expect(src).not.toContain("<svg");
  });

  it.each(["src/app/icon.tsx", "src/app/apple-icon.tsx", "src/app/opengraph-image.tsx"])(
    "%s (favicon / touch icon / share image) is drawn from logo.png",
    (file) => {
      const src = read(file);
      expect(src).toContain('"logo.png"');
      expect(src).not.toContain("<svg");
    },
  );

  it("no component still draws the old three-dot V mark", () => {
    const offenders = sourceFiles(join(ROOT, "src")).filter((f) => readFileSync(f, "utf8").includes('x2="12" y2="18.5"'));
    expect(offenders).toEqual([]);
  });

  it("ships a web-sized logo.png and a real favicon.ico", () => {
    expect(statSync(join(ROOT, "public/logo.png")).size).toBeLessThan(200 * 1024);
    const ico = readFileSync(join(ROOT, "public/favicon.ico"));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
  });
});
