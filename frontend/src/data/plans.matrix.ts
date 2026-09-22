import type { FeatureRow } from "./plans.types";

/* ─── Feature matrix ──────────────────────────────────────────────────
   Every cell is filled for every plan: a string renders as a value, a
   boolean renders as a tick or a cross. Plan cards derive their included
   / not-included lists from this same table, so a card and the comparison
   table can never disagree. */

export const FEATURE_MATRIX: FeatureRow[] = [
  { label: "Chat messages/day",      values: { free: "25", pro: "2,000", business: "2,000" } },
  { label: "Code messages/day",      values: { free: "3",  pro: "500",   business: "500" } },
  { label: "Image generation/day",   values: { free: "20", pro: "200",   business: "200" } },
  { label: "Web search/day",         values: { free: "5",  pro: "500",   business: "500" } },
  { label: "Vision (image analysis)",values: { free: false, pro: true,  business: true } },
  { label: "Voice (text-to-speech)", values: { free: false, pro: true,  business: true } },
  { label: "Reasoning mode",         values: { free: false, pro: true,  business: true } },
  { label: "Custom agents",          values: { free: false, pro: true,  business: true } },
  { label: "Canvas documents",       values: { free: false, pro: true,  business: true } },
  { label: "Code sandbox",           values: { free: false, pro: true,  business: true } },
  { label: "Priority queue",         values: { free: false, pro: true,  business: true } },
  { label: "Deep research",          values: { free: false, pro: false, business: true } },
  { label: "API access (beta)",      values: { free: false, pro: true,  business: true } },
];

// Removed from here on 2026-09-25: "Team collaboration", "SSO" and "Custom
// SLAs" were advertised on the Business tier with no backing implementation
// anywhere in the product (no team/org data model, no SAML/OIDC enterprise
// login beyond the existing per-user Google/GitHub/Microsoft OAuth, no SLA
// monitoring/credit system) -- see the audit notes in the PR that removed
// them. Re-add a row here only once the feature is real.
