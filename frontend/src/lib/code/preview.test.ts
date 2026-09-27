import { describe, expect, it } from "vitest";
import {
  PREVIEW_SANDBOX, buildPreviewDocument, buildStandalonePage, inlineAssets, isPreviewMessage, PREVIEW_MESSAGE_SOURCE,
} from "./preview";

const file = (name: string, content: string) => ({ name, content });

describe("PREVIEW_SANDBOX", () => {
  it("never grants allow-same-origin (would expose the session token)", () => {
    expect(PREVIEW_SANDBOX).not.toContain("allow-same-origin");
    expect(PREVIEW_SANDBOX).toContain("allow-scripts");
  });
});

describe("inlineAssets", () => {
  const html = `<!doctype html><html><head><link rel="stylesheet" href="./styles.css"></head><body><h1>Hi</h1><script src="script.js"></script></body></html>`;

  it("replaces referenced stylesheets and scripts with inline tags", () => {
    const out = inlineAssets(html, [file("styles.css", "h1{color:red}"), file("script.js", "console.log(1)")]);
    expect(out).not.toMatch(/href=["']\.\/styles\.css/);
    expect(out).not.toMatch(/src=["']script\.js/);
    expect(out).toContain("<style");
    expect(out).toContain("h1{color:red}");
    expect(out).toContain("console.log(1)");
  });

  it("applies unreferenced CSS in <head> and JS before </body>", () => {
    const out = inlineAssets("<html><head></head><body><p>x</p></body></html>", [file("a.css", "p{}"), file("b.js", "go()")]);
    expect(out.indexOf("p{}")).toBeLessThan(out.indexOf("<body>"));
    expect(out.indexOf("go()")).toBeGreaterThan(out.indexOf("<p>x</p>"));
    expect(out.indexOf("go()")).toBeLessThan(out.indexOf("</body>"));
  });

  it("keeps $ sequences in code intact (jQuery, template literals)", () => {
    const js = "$('#a').text(`${x}`); var s = \"$&$'$`\";";
    expect(inlineAssets("<body></body>", [file("app.js", js)])).toContain(js);
    expect(inlineAssets(`<script src="app.js"></script>`, [file("app.js", js)])).toContain(js);
    expect(inlineAssets("<head></head>", [file("s.css", "a::after{content:\"$'\"}")])).toContain("content:\"$'\"");
  });

  it("escapes a closing script tag inside inlined code", () => {
    const out = inlineAssets("<body></body>", [file("x.js", 'document.write("</script><b>")')]);
    expect(out).toContain("<\\/script>");
    expect(out.match(/<\/script>/g)!.length).toBe(1);
  });

  it("preserves attributes such as type=module", () => {
    const out = inlineAssets(`<script type="module" src="main.js"></script>`, [file("main.js", "x()")]);
    expect(out).toMatch(/<script type="module"[^>]*>\s*x\(\)/);
  });

  it("matches files referenced with a folder prefix", () => {
    const out = inlineAssets(`<head><link href="css/site.css" rel="stylesheet"></head>`, [file("site.css", "body{}")]);
    expect(out).toContain("body{}");
    expect(out).not.toContain('href="css/site.css"');
  });
});

describe("buildPreviewDocument", () => {
  it("prefers index.html and injects the console bridge first", () => {
    const doc = buildPreviewDocument([file("about.html", "<p>about</p>"), file("index.html", "<html><head></head><body>home</body></html>")]);
    expect(doc.kind).toBe("html");
    expect(doc.html).toContain("home");
    expect(doc.html!.indexOf(PREVIEW_MESSAGE_SOURCE)).toBeLessThan(doc.html!.indexOf("home"));
  });

  it("runs a lone JavaScript file in a console runner", () => {
    const doc = buildPreviewDocument([file("app.js", "console.log(2+2)")]);
    expect(doc.kind).toBe("javascript");
    expect(doc.html).toContain("console.log(2+2)");
    expect(doc.html).toContain('id="out"');
  });

  it("runs Python via the pinned in-browser runtime", () => {
    const doc = buildPreviewDocument([file("main.py", "print('hi')")]);
    expect(doc.kind).toBe("python");
    expect(doc.html).toMatch(/cdn\.jsdelivr\.net\/npm\/pyodide@\d+\.\d+\.\d+\/pyodide\.js/);
    expect(doc.html).toContain(JSON.stringify("print('hi')"));
  });

  it("previews a lone stylesheet on sample markup", () => {
    expect(buildPreviewDocument([file("s.css", "h1{}")]).kind).toBe("css");
  });

  it("explains when nothing can run", () => {
    const doc = buildPreviewDocument([file("main.go", "package main")]);
    expect(doc.kind).toBe("none");
    expect(doc.html).toBeNull();
    expect(doc.reason).toContain(".go");
  });

  it("waits when there is no code", () => {
    expect(buildPreviewDocument([file("index.html", "  ")]).reason).toMatch(/waiting/i);
  });

  it("honours the active file when several runnable files exist", () => {
    const doc = buildPreviewDocument([file("a.js", "A()"), file("b.js", "B()")], "b.js");
    expect(doc.html).toContain("B()");
    expect(doc.html).not.toContain("A()");
  });
});

describe("buildStandalonePage", () => {
  it("frames the preview in the same sandbox instead of running it top-level", () => {
    const page = buildStandalonePage('<script>alert("x")</script>');
    expect(page).toContain(`sandbox="${PREVIEW_SANDBOX}"`);
    expect(page).not.toMatch(/<script>alert/);
    expect(page).toContain('srcdoc="&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"');
  });
});

describe("isPreviewMessage", () => {
  it("accepts only well-formed bridge messages", () => {
    expect(isPreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, level: "log", text: "x" })).toBe(true);
    expect(isPreviewMessage({ source: "other", level: "log", text: "x" })).toBe(false);
    expect(isPreviewMessage({ source: PREVIEW_MESSAGE_SOURCE, level: "eval", text: "x" })).toBe(false);
    expect(isPreviewMessage(null)).toBe(false);
  });
});
