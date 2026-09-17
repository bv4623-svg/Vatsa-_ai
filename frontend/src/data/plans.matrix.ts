import type { FeatureRow } from "./plans.types";

/* ─── Feature matrix ──────────────────────────────────────────────────
   Every cell is filled for every plan: a string renders as a value, a
   boolean renders as a tick or a cross. Plan cards derive their included
   / not-included lists from this same table, so a card and the comparison
   table can never disagree. */

export const FEATURE_MATRIX: FeatureRow[] = [
  { label: "Chat messages/day",      values: { free: "25", pro: "2,000",    business: "2,000",    ultra: "Unlimited" } },
  { label: "Code messages/day",      values: { free: "3",  pro: "500",      business: "500",      ultra: "Unlimited" } },
  { label: "Image generation/day",   values: { free: "20", pro: "200",      business: "200",      ultra: "500" } },
  { label: "Web search/day",         values: { free: "5",  pro: "500",      business: "500",      ultra: "5,000" } },
  { label: "Vision (image analysis)",values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Voice (text-to-speech)", values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Reasoning mode",         values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Custom agents",          values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Canvas documents",       values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Code sandbox",           values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Priority queue",         values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Deep research",          values: { free: false, pro: false, business: true,  ultra: true } },
  { label: "Vatsa Ultra model",      values: { free: false, pro: false, business: false, ultra: true } },
  { label: "Team collaboration",     values: { free: false, pro: false, business: true,  ultra: true } },
  { label: "SSO",                    values: { free: false, pro: false, business: true,  ultra: true } },
  { label: "API access (beta)",      values: { free: false, pro: true,  business: true,  ultra: true } },
  { label: "Custom SLAs",            values: { free: false, pro: false, business: true,  ultra: true } },
];
