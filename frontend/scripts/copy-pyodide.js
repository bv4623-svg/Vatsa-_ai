#!/usr/bin/env node
/**
 * Copies the Pyodide runtime from node_modules into public/pyodide/ so the
 * code preview runs Python from this site's own origin instead of a CDN
 * (works where the CDN is blocked, and no third party sees who runs code).
 * Runs before `next dev` and `next build`; public/pyodide/ is gitignored.
 */
const fs = require("fs");
const path = require("path");

const FILES = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
const src = path.join(__dirname, "..", "node_modules", "pyodide");
const dest = path.join(__dirname, "..", "public", "pyodide");

const pkg = JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8"));
fs.mkdirSync(dest, { recursive: true });
for (const file of FILES) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
fs.writeFileSync(path.join(dest, "VERSION"), pkg.version + "\n");
console.log(`Pyodide ${pkg.version} copied to public/pyodide/ (${FILES.length} files)`);
