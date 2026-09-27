import { describe, expect, it } from "vitest";
import { detectFileName, extractAllCodeBlocks, normalizeResponse } from "./parsing";

describe("detectFileName", () => {
  it.each([
    ["html index.html", "<p>", "", "index.html"],
    ["css:styles.css", "a{}", "", "styles.css"],
    ['js title="app.js"', "x()", "", "app.js"],
    ["html", "<!-- index.html -->\n<p>", "", "index.html"],
    ["js", "// script.js\nx()", "", "script.js"],
    ["css", "/* styles.css */\na{}", "", "styles.css"],
    ["python", "# main.py\nprint(1)", "", "main.py"],
    ["js", "// filename: src/app.js\nx()", "", "src/app.js"],
    ["css", "a{}", "Here is the stylesheet:\n\n**styles.css**", "styles.css"],
    ["js", "x()", "Create `script.js`:", "script.js"],
    ["js", "// add two numbers\nx()", "", null],
    ["python", "# TODO fix\nprint()", "", null],
    ["html", "<p>", "", null],
    ["sh", "rm -rf x", "", null],
  ])("%s", (info, code, preceding, expected) => {
    expect(detectFileName(info, code, preceding)).toBe(expected);
  });

  it("rejects path traversal and absolute names", () => {
    expect(detectFileName("js ../../etc/passwd.js", "x", "")).toBeNull();
    expect(detectFileName("js /etc/x.js", "x", "")).toBeNull();
  });
});

describe("extractAllCodeBlocks", () => {
  const reply = [
    "**index.html**",
    "```html",
    '<link href="styles.css" rel="stylesheet"><script src="script.js"></script>',
    "```",
    "```css",
    "/* styles.css */",
    "body{}",
    "```",
    "```javascript script.js",
    "console.log(1)",
    "```",
  ].join("\n");

  it("uses the names the model gave, so the page's references resolve", () => {
    expect(extractAllCodeBlocks(reply).map((b) => b.name)).toEqual(["index.html", "styles.css", "script.js"]);
  });

  it("falls back to file.<ext> with de-duplication", () => {
    const names = extractAllCodeBlocks("```js\na()\n```\n```js\nb()\n```\n```py\nc\n```").map((b) => b.name);
    expect(names).toEqual(["file.js", "file-2.js", "file.py"]);
  });

  it("never gives two blocks the same name", () => {
    const names = extractAllCodeBlocks("```js app.js\na()\n```\n```js app.js\nb()\n```").map((b) => b.name);
    expect(new Set(names).size).toBe(2);
  });

  it("skips empty blocks", () => {
    expect(extractAllCodeBlocks("```js\n\n```")).toEqual([]);
  });
});

describe("normalizeResponse", () => {
  it("handles null", () => {
    expect(normalizeResponse(null).files).toEqual([]);
  });
  it("extracts files from a text response", () => {
    expect(normalizeResponse({ response: "```html index.html\n<p>x</p>\n```" }).files[0].name).toBe("index.html");
  });
});
