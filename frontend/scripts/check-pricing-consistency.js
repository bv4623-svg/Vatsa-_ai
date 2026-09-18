#!/usr/bin/env node
/**
 * CI gate for the "only two prices, defined once" rule.
 *
 *   1. PARITY   frontend/src/config/pricing.ts and Backend/app/config/pricing.py
 *               hold the same prices, INR rate and access period, and the
 *               paid prices are exactly $24 and $99.
 *   2. LITERALS No other file in the frontend source or the backend app
 *               writes a currency amount ("$24", "₹1,992", "24 USD", "Rs 500").
 *               Every price on screen is computed from the config.
 *   3. GATEWAY  Razorpay is the only payment gateway: no other gateway's
 *               name, and none of its SDKs in a dependency manifest.
 *   4. PLANS    "Ultra" no longer exists as a plan.
 *
 * Run: node scripts/check-pricing-consistency.js   (npm run check:pricing)
 * Exit code 1 on any failure, so it can gate a Netlify build or CI job.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPO = path.resolve(ROOT, "..");
const FRONTEND_SRC = path.join(ROOT, "src");
const BACKEND_APP = path.join(REPO, "Backend", "app");

const FRONTEND_CONFIG = path.join(FRONTEND_SRC, "config", "pricing.ts");
const BACKEND_CONFIG = path.join(BACKEND_APP, "config", "pricing.py");

const EXPECTED_PAID_PRICES = { pro: 24, business: 99 };

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "__pycache__", ".venv", "venv"]);
const SCANNED = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".py", ".md", ".html"]);

// The two files that define prices; everything else must import them.
const PRICE_DEFINITIONS = new Set([FRONTEND_CONFIG, BACKEND_CONFIG]);

// Files that legitimately mention a retired plan id, to map old accounts.
const LEGACY_ULTRA_ALLOWED = new Set([
  path.join(FRONTEND_SRC, "lib", "session.ts"),
  path.join(BACKEND_APP, "services", "feature_access.py"),
]);

// A digit right after a currency symbol/code, or a number followed by one.
const PRICE_LITERAL = [
  /[$₹€£]\s?\d/,
  /\bRs\.?\s?\d/i,
  /\bINR\s?\d/,
  /\bUSD\s?\d/,
  /\d\s?(USD|INR|rupees?)\b/i,
];

const OTHER_GATEWAYS = /\b(stripe|paypal|cashfree|paddle|lemon\s?squeezy|instamojo|payu|braintree|adyen|square\s?up)\b/i;
const ULTRA_PLAN = /["'`]ultra["'`]|\bUltra\b/;

const failures = [];
const results = [];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCANNED.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(REPO, file).split(path.sep).join("/");
}

function record(name, problems) {
  results.push({ name, ok: problems.length === 0, problems });
  failures.push(...problems);
}

function scanLines(files, test, skip = () => false) {
  const hits = [];
  for (const file of files) {
    if (skip(file)) continue;
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (test(line)) hits.push(`${rel(file)}:${i + 1}  ${line.trim().slice(0, 110)}`);
      });
  }
  return hits;
}

// ── 1. Parity ────────────────────────────────────────────────────────
function readConfigs() {
  const ts = fs.readFileSync(FRONTEND_CONFIG, "utf8");
  const num = (src, re) => {
    const m = src.match(re);
    return m ? Number(m[1]) : NaN;
  };
  const frontend = {
    pro: num(ts, /PRICES_USD[^{]*\{[^}]*\bpro:\s*(\d+)/),
    business: num(ts, /PRICES_USD[^{]*\{[^}]*\bbusiness:\s*(\d+)/),
    rate: num(ts, /USD_TO_INR\s*=\s*(\d+)/),
    days: num(ts, /ACCESS_DAYS\s*=\s*(\d+)/),
  };

  if (!fs.existsSync(BACKEND_CONFIG)) return { frontend, backend: null };
  const py = fs.readFileSync(BACKEND_CONFIG, "utf8");
  const backend = {
    pro: num(py, /PRICES_USD\s*=\s*\{[^}]*"pro":\s*(\d+)/),
    business: num(py, /PRICES_USD\s*=\s*\{[^}]*"business":\s*(\d+)/),
    rate: num(py, /USD_TO_INR\s*=\s*(\d+)/),
    days: num(py, /ACCESS_DAYS\s*=\s*(\d+)/),
  };
  return { frontend, backend };
}

function checkParity() {
  const problems = [];
  const { frontend, backend } = readConfigs();

  for (const [plan, price] of Object.entries(EXPECTED_PAID_PRICES)) {
    if (frontend[plan] !== price) problems.push(`frontend config: ${plan} is ${frontend[plan]}, expected ${price}`);
  }
  if (!Number.isFinite(frontend.rate) || !Number.isFinite(frontend.days)) {
    problems.push("frontend config: USD_TO_INR / ACCESS_DAYS not found");
  }

  if (!backend) {
    console.warn("  ! Backend/app/config/pricing.py not found -- skipping frontend/backend parity (frontend-only checkout).");
  } else {
    for (const key of Object.keys(frontend)) {
      if (frontend[key] !== backend[key]) {
        problems.push(`frontend ${key}=${frontend[key]} but backend ${key}=${backend[key]}`);
      }
    }
  }
  record("Frontend and backend price constants match ($24 Pro, $99 Business)", problems);

  if (Number.isFinite(frontend.rate)) {
    const inr = Object.fromEntries(Object.entries(EXPECTED_PAID_PRICES).map(([k, v]) => [k, v * frontend.rate]));
    console.log(`  fixed rate 1 USD = ${frontend.rate} INR  ->  Pro ₹${inr.pro.toLocaleString("en-IN")}, Business ₹${inr.business.toLocaleString("en-IN")}`);
  }
}

// ── 2-4. Scans ───────────────────────────────────────────────────────
function checkScans() {
  const frontendFiles = walk(FRONTEND_SRC);
  const backendFiles = walk(BACKEND_APP);
  const all = [...frontendFiles, ...backendFiles];
  const isDefinition = (f) => PRICE_DEFINITIONS.has(f);

  record(
    "Zero hardcoded price literals outside the two config files",
    scanLines(all, (line) => PRICE_LITERAL.some((re) => re.test(line)), isDefinition)
  );

  const manifests = [
    path.join(ROOT, "package.json"),
    path.join(REPO, "Backend", "requirements.txt"),
    path.join(REPO, "Backend", "requirements-dev.txt"),
  ].filter((f) => fs.existsSync(f));
  record("Razorpay is the only payment gateway (no other gateway code or SDK)", [
    ...scanLines(all, (line) => OTHER_GATEWAYS.test(line)),
    ...scanLines(manifests, (line) => OTHER_GATEWAYS.test(line)),
  ]);

  record(
    "No Ultra plan left",
    scanLines(all, (line) => ULTRA_PLAN.test(line), (f) => LEGACY_ULTRA_ALLOWED.has(f))
  );
}

function main() {
  console.log("Pricing consistency check");
  checkParity();
  checkScans();

  console.log("");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
    for (const p of r.problems) console.log(`        ${p}`);
  }

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problem(s). Prices belong in src/config/pricing.ts (and Backend/app/config/pricing.py) only.`);
    process.exit(1);
  }
  console.log("\n✓ Only $24 and $99 exist, defined once per codebase, with nothing else hardcoded.");
}

main();
