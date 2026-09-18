#!/usr/bin/env node
/**
 * CI gate: fails if any of Vatsa's own canonical plan prices are
 * hardcoded as a literal outside src/data/plans*.ts. Those files are the
 * single source of truth (see plans.ts's own header comment) -- every
 * other price shown anywhere in the app must be computed from an import
 * of them, never retyped.
 *
 * Only matches Vatsa's own published numbers (not any "$<number>"),
 * so a landing-page comparison table quoting a *competitor's* per-token
 * API pricing (e.g. "$15 / MTok" for a third-party model) is not a false
 * positive -- those numbers don't appear in this list.
 *
 * Run: node scripts/check-pricing-consistency.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const EXCLUDED_DIRS = new Set(["node_modules", ".next", ".git"]);
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx"]);

// Files that ARE the source of truth -- literals here are the definitions,
// not duplicates of them.
const ALLOWED_FILES = [
  path.join(SRC, "data", "plans.ts"),
  path.join(SRC, "data", "plans.types.ts"),
  path.join(SRC, "data", "plans.data.ts"),
  path.join(SRC, "data", "plans.matrix.ts"),
  path.join(SRC, "data", "plans.limits.ts"),
  path.join(SRC, "data", "plans.utils.ts"),
  path.join(SRC, "data", "plans.content.ts"),
];

// Canonical values from data/plans.ts, as they'd appear written out: the
// bare monthly prices and their GST-inclusive totals, in both currencies.
// Word-boundary + currency-symbol anchored so "$249" or "2499" don't match,
// and specifically NOT followed by more decimal digits, so a third-party
// model's own per-token price (e.g. "$0.9 / MTok") isn't a false positive.
// $0/₹0 (the Free plan) is deliberately not checked: it collides with any
// fractional third-party price starting "$0." and a wrong "free" price is
// not a realistic mistake anyone would hand-type.
const FORBIDDEN_PATTERNS = [
  /\$24(?![.\d])/, /\$28\.32(?!\d)/,
  /\$99(?![.\d])/, /\$116\.82(?!\d)/,
  /\$49(?![.\d])/, /\$57\.82(?!\d)/,
  /₹499(?![.\d])/, /₹588\.82(?!\d)/,
  /₹1999(?![.\d])/, /₹2358\.82(?!\d)/,
  /₹1499(?![.\d])/, /₹1768\.82(?!\d)/,
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const violations = [];

  for (const file of walk(SRC)) {
    if (ALLOWED_FILES.includes(file)) continue;

    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({ file: path.relative(ROOT, file), line: i + 1, text: line.trim(), pattern: pattern.source });
          break;
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error(`\n✗ Found ${violations.length} hardcoded Vatsa plan price(s) outside src/data/plans*.ts:\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.text}`);
    }
    console.error("\nImport the price from \"@/data/plans\" instead (getPlan, listPrice, periodPrice, formatPrice, ...).\n");
    process.exit(1);
  }

  console.log("✓ No hardcoded Vatsa plan prices found outside src/data/plans*.ts");
}

main();
