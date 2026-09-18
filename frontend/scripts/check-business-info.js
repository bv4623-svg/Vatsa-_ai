#!/usr/bin/env node
/**
 * Razorpay verification reviewers look for the same business name, address
 * and contact details on every page. This checks that src/config/business.json
 * is filled in and that no page hardcodes a different email address.
 *
 * Run: node scripts/check-business-info.js   (npm run check:business)
 * Exit code 1 while anything is missing, so it doubles as a go-live gate.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const CONFIG = path.join(SRC, "config", "business.json");
const REQUIRED_PAGES = ["about", "contact", "privacy", "refund", "terms", "pricing"];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const SCANNED = new Set([".ts", ".tsx"]);
// Sample addresses used as input placeholders / fallbacks, not contact details.
const PLACEHOLDER = /^(you|user|john|name|test)@/i;

const business = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const checks = [];

function check(name, ok, fix) {
  checks.push({ name, ok, fix });
}

const filled = (v) => typeof v === "string" && v.trim().length > 0;
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || "");
const fullAddress = (business.addressLines || []).map((l) => l.trim()).filter(Boolean).join(", ");

check(
  "Legal business name is set",
  filled(business.legalName),
  'Set "legalName" in src/config/business.json to the entity name on your Razorpay KYC.'
);
check(
  "Full postal address is set (with PIN code)",
  fullAddress.length > 0 && /\b\d{6}\b/.test(fullAddress),
  'Set "addressLines" in src/config/business.json: street, area, city, state, 6-digit PIN, country.'
);
check(
  "Phone number is set",
  filled(business.phone) && business.phone.replace(/\D/g, "").length >= 10,
  'Set "phone" in src/config/business.json, e.g. "+91 98765 43210".'
);
check("Support email is valid", validEmail(business.supportEmail), 'Fix "supportEmail" in src/config/business.json.');
check("Contact email is valid", validEmail(business.contactEmail), 'Fix "contactEmail" in src/config/business.json.');

// Every mandatory page exists.
for (const page of REQUIRED_PAGES) {
  check(`Page /${page} exists`, fs.existsSync(path.join(SRC, "app", page, "page.tsx")), `Create src/app/${page}/page.tsx.`);
}
check("Home page exists", fs.existsSync(path.join(SRC, "app", "page.tsx")), "Create src/app/page.tsx.");

// No page may hardcode an email other than the configured ones.
const allowed = new Set([business.supportEmail, business.contactEmail].filter(Boolean).map((e) => e.toLowerCase()));
const strayEmails = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (SCANNED.has(path.extname(entry.name))) {
      fs.readFileSync(full, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const m of line.match(EMAIL) || []) {
            if (!allowed.has(m.toLowerCase()) && !PLACEHOLDER.test(m) && !/\.(png|jpe?g|svg|webp)$/i.test(m)) {
              strayEmails.push(`${path.relative(ROOT, full).split(path.sep).join("/")}:${i + 1}  ${m}`);
            }
          }
        });
    }
  }
})(SRC);
check(
  "No page hardcodes an email other than the configured ones",
  strayEmails.length === 0,
  strayEmails.join("\n        ")
);

console.log("Business information check\n");
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  if (!c.ok) console.log(`        ${c.fix}`);
}

const failed = checks.filter((c) => !c.ok).length;
if (failed > 0) {
  console.error(`\n✗ ${failed} check(s) failing. Razorpay verification needs these filled in.`);
  process.exit(1);
}
console.log("\n✓ Business information is complete and consistent.");
