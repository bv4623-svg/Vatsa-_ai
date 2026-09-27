/**
 * Turns the files the AI generated into one document the sandboxed preview
 * iframe can run, and defines the sandbox itself.
 *
 * Security model: the preview iframe is sandboxed WITHOUT allow-same-origin,
 * so generated code runs in an opaque origin. It can't read this app's
 * localStorage (where the session token lives), cookies, or DOM. Output
 * reaches the parent only through postMessage, which the parent accepts
 * solely from that iframe's window.
 */
import type { ProjectFile } from "@/types/code";

/** Never add allow-same-origin: with allow-scripts it lets the framed code
 * remove its own sandbox and read the app's session token. */
export const PREVIEW_SANDBOX = "allow-scripts allow-modals allow-forms allow-popups";

export const PREVIEW_MESSAGE_SOURCE = "vatsa-preview";

/** Must equal the exact "pyodide" version in package.json (a unit test
 * checks). The runtime is copied from node_modules to public/pyodide/ by
 * scripts/copy-pyodide.js and served from this site, not a CDN. */
export const PYODIDE_VERSION = "0.29.5";
export const PYODIDE_PATH = "/pyodide/";

export interface PreviewOptions {
  /** Absolute URL of the self-hosted runtime, e.g. https://app.example/pyodide/.
   * Absolute because the runner lives in an opaque-origin srcdoc frame (and,
   * for "open in new tab", inside a blob: page) where relative URLs don't
   * resolve to this site. */
  pyodideBaseUrl?: string;
}

export type PreviewKind = "html" | "javascript" | "python" | "css" | "none";

export interface PreviewDocument {
  kind: PreviewKind;
  html: string | null;
  /** Why there is nothing to run, for the empty state. */
  reason?: string;
}

export interface ConsoleEntry {
  level: "log" | "info" | "warn" | "error" | "result";
  text: string;
}

const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();
const isHtml = (f: ProjectFile) => /^html?$/.test(extOf(f.name));
const isCss = (f: ProjectFile) => extOf(f.name) === "css";
const isJs = (f: ProjectFile) => ["js", "mjs"].includes(extOf(f.name));
const isPy = (f: ProjectFile) => extOf(f.name) === "py";

/** `</script>` inside inlined code would end the tag early. */
// Function replacements instead of backreference strings keep
// scripts/check-pricing-consistency.js from reading them as dollar prices.
const escapeScript = (code: string) => code.replace(/<\/(script)/gi, (_m, tag: string) => `<\\/${tag}`);
const escapeStyle = (css: string) => css.replace(/<\/(style)/gi, (_m, tag: string) => `<\\/${tag}`);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const baseName = (name: string) => name.split("/").pop() || name;

/** Forwards console output and uncaught errors to the parent window. Runs
 * first in every preview document. */
export const CONSOLE_BRIDGE = `<script>(function(){
  var S=${JSON.stringify(PREVIEW_MESSAGE_SOURCE)};
  function fmt(a){try{if(a instanceof Error)return a.stack||String(a);if(typeof a==="object")return JSON.stringify(a,null,2);return String(a);}catch(e){return String(a);}}
  function send(level,args){try{parent.postMessage({source:S,level:level,text:Array.prototype.map.call(args,fmt).join(" ")},"*");}catch(e){}}
  ["log","info","warn","error"].forEach(function(l){var o=console[l];console[l]=function(){send(l,arguments);return o&&o.apply(console,arguments);};});
  window.addEventListener("error",function(e){send("error",[e.message+(e.lineno?" (line "+e.lineno+")":"")]);});
  window.addEventListener("unhandledrejection",function(e){send("error",["Unhandled promise rejection: "+fmt(e.reason)]);});
  window.__vatsaSend=send;
})();</script>`;

function injectIntoHead(html: string, snippet: string): string {
  // Function replacements throughout: generated code routinely contains
  // `$'`/`$&` (jQuery, template literals), which string replacements expand.
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${snippet}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${snippet}</head>`);
  return `${snippet}\n${html}`;
}

function injectBeforeBodyEnd(html: string, snippet: string): string {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, () => `${snippet}\n</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, () => `${snippet}\n</html>`);
  return `${html}\n${snippet}`;
}

/** Inlines generated CSS/JS files into the HTML page. The preview has no
 * file server, so `<link href="styles.css">` and `<script src="app.js">`
 * would otherwise 404 and the page rendered unstyled and inert. Files the
 * HTML doesn't reference are still applied (CSS in head, JS at the end). */
export function inlineAssets(html: string, files: ProjectFile[]): string {
  let out = html;
  for (const css of files.filter(isCss)) {
    const name = escapeRegExp(baseName(css.name));
    const linkRe = new RegExp(`<link\\b[^>]*href=["'](?:\\./|/)?(?:[\\w.-]+/)*${name}["'][^>]*>`, "gi");
    const tag = `<style data-file="${escapeHtml(css.name)}">\n${escapeStyle(css.content)}\n</style>`;
    out = out.search(linkRe) >= 0 ? out.replace(linkRe, () => tag) : injectIntoHead(out, tag);
  }
  for (const js of files.filter(isJs)) {
    const name = escapeRegExp(baseName(js.name));
    const scriptRe = new RegExp(`<script\\b([^>]*?)\\ssrc=["'](?:\\./|/)?(?:[\\w.-]+/)*${name}["']([^>]*)>\\s*</script>`, "gi");
    const code = escapeScript(js.content);
    if (out.search(scriptRe) >= 0) {
      out = out.replace(scriptRe, (_m, pre: string, post: string) => `<script${pre}${post} data-file="${escapeHtml(js.name)}">\n${code}\n</script>`);
    } else {
      out = injectBeforeBodyEnd(out, `<script data-file="${escapeHtml(js.name)}">\n${code}\n</script>`);
    }
  }
  return out;
}

const RUNNER_STYLE = `<style>
  body{margin:0;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#0b0b0f;color:#e5e7eb}
  header{padding:8px 12px;border-bottom:1px solid #27272a;color:#a1a1aa;font-family:system-ui,sans-serif}
  #out{padding:12px;white-space:pre-wrap;word-break:break-word}
  .error{color:#f87171}.warn{color:#fbbf24}.info{color:#93c5fd}.result{color:#86efac}
</style>`;

const RUNNER_OUTPUT = `<script>(function(){
  var out=document.getElementById("out");var send=window.__vatsaSend;
  window.__vatsaPrint=function(level,text){var d=document.createElement("div");d.className=level;d.textContent=text;out.appendChild(d);};
  ["log","info","warn","error"].forEach(function(l){var o=console[l];console[l]=function(){var t=Array.prototype.map.call(arguments,function(a){try{return typeof a==="object"?JSON.stringify(a,null,2):String(a)}catch(e){return String(a)}}).join(" ");window.__vatsaPrint(l,t);return o&&o.apply(console,arguments);};});
})();</script>`;

export function buildJavaScriptRunner(code: string, title = "script.js"): string {
  return `<!doctype html><html><head><meta charset="utf-8">${CONSOLE_BRIDGE}${RUNNER_STYLE}</head><body>
<header>Running ${escapeHtml(title)}</header><div id="out"></div>${RUNNER_OUTPUT}
<script>
try {
${escapeScript(code)}
} catch (e) { console.error(e && e.stack ? e.stack : String(e)); }
</script>
<script>setTimeout(function(){ if(!document.getElementById("out").childNodes.length) window.__vatsaPrint("info","(finished with no output)"); }, 0);</script>
</body></html>`;
}

export function buildPythonRunner(code: string, title = "main.py", pyodideBaseUrl = PYODIDE_PATH): string {
  const base = pyodideBaseUrl.endsWith("/") ? pyodideBaseUrl : `${pyodideBaseUrl}/`;
  return `<!doctype html><html><head><meta charset="utf-8">${CONSOLE_BRIDGE}${RUNNER_STYLE}</head><body>
<header>Running ${escapeHtml(title)} (Python in your browser)</header><div id="out"><div class="info">Loading Python runtime…</div></div>${RUNNER_OUTPUT}
<script src="${escapeHtml(base)}pyodide.js"></script>
<script>
(async function(){
  var out=document.getElementById("out");
  if (typeof loadPyodide !== "function") { out.innerHTML=""; console.error("Could not load the Python runtime. Check your connection and try again."); return; }
  try {
    var py = await loadPyodide({ indexURL: ${JSON.stringify(base)},
      stdout: function(t){ console.log(t); }, stderr: function(t){ console.error(t); } });
    out.innerHTML="";
    var result = await py.runPythonAsync(${JSON.stringify(code)});
    if (result !== undefined && result !== null) window.__vatsaPrint("result", String(result));
    if (!out.childNodes.length) window.__vatsaPrint("info","(finished with no output)");
  } catch (e) {
    out.innerHTML = out.innerHTML.indexOf("Loading Python") >= 0 ? "" : out.innerHTML;
    var msg = String(e && e.message ? e.message : e);
    // Pyodide suggests micropip for missing packages, which can't work here
    // (no package index is served); say what actually applies instead.
    var missing = /ModuleNotFoundError: (?:No module named |The module )'([^']+)'/.exec(msg);
    if (missing) {
      console.error("Package '" + missing[1] + "' isn't available: Python here runs in your browser with the standard library only (no pip packages).");
    } else {
      console.error(msg);
    }
  }
})();
</script></body></html>`;
}

/** Picks what to run: an HTML page (with CSS/JS inlined), else a JS or
 * Python runner, else a page showing the stylesheet. */
export function buildPreviewDocument(files: ProjectFile[], preferred?: string, options: PreviewOptions = {}): PreviewDocument {
  const nonEmpty = files.filter((f) => f.content.trim());
  if (!nonEmpty.length) return { kind: "none", html: null, reason: "Waiting for code…" };

  const htmlFiles = nonEmpty.filter(isHtml);
  const main =
    htmlFiles.find((f) => f.name === preferred) ||
    htmlFiles.find((f) => /(^|\/)index\.html?$/i.test(f.name)) ||
    htmlFiles[0];
  if (main) {
    return { kind: "html", html: injectIntoHead(inlineAssets(main.content, nonEmpty), CONSOLE_BRIDGE) };
  }

  const pick = (pred: (f: ProjectFile) => boolean) =>
    nonEmpty.find((f) => f.name === preferred && pred(f)) || nonEmpty.find(pred);
  const js = pick(isJs);
  if (js) return { kind: "javascript", html: buildJavaScriptRunner(js.content, js.name) };
  const py = pick(isPy);
  if (py) return { kind: "python", html: buildPythonRunner(py.content, py.name, options.pyodideBaseUrl) };
  const css = pick(isCss);
  if (css) {
    const sample = `<!doctype html><html><head>${CONSOLE_BRIDGE}<style>${escapeStyle(css.content)}</style></head><body><h1>Heading</h1><p>Paragraph with <a href="#">a link</a>.</p><button>Button</button></body></html>`;
    return { kind: "css", html: sample };
  }
  const exts = Array.from(new Set(nonEmpty.map((f) => "." + extOf(f.name)))).join(", ");
  return { kind: "none", html: null, reason: `Nothing to run for ${exts} files. Preview supports HTML/CSS/JS pages, JavaScript and Python.` };
}

/** Wraps a preview in a standalone page for "open in new tab". The outer
 * page contains no generated code; the generated document runs inside a
 * sandboxed srcdoc iframe with an opaque origin, exactly like the inline
 * preview (a plain blob: URL would inherit this app's origin). */
export function buildStandalonePage(previewHtml: string, title = "Vatsa AI preview"): string {
  const srcdoc = escapeHtml(previewHtml).replace(/"/g, "&quot;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>html,body,iframe{margin:0;height:100%;width:100%;border:0;display:block}</style></head>
<body><iframe sandbox="${PREVIEW_SANDBOX}" srcdoc="${srcdoc}"></iframe></body></html>`;
}

export function isPreviewMessage(data: unknown): data is { source: string; level: ConsoleEntry["level"]; text: string } {
  const d = data as { source?: unknown; level?: unknown; text?: unknown } | null;
  return (
    !!d && d.source === PREVIEW_MESSAGE_SOURCE && typeof d.text === "string" &&
    ["log", "info", "warn", "error", "result"].includes(String(d.level))
  );
}
