/**
 * Single source of truth for every plan, price and feature claim.
 *
 * The pricing page, the in-app upgrade modal, the upgrade banner and the
 * sidebar card all read from here. Nothing in the UI may hardcode a price,
 * a plan name or a feature row -- that is what let /pricing advertise
 * "$24/month" while the upgrade modal advertised "₹499/mo" for the same
 * plan.
 *
 * Barrel: the definitions live in the sibling plans.* modules so each file
 * stays small. Import from "@/data/plans" and everything resolves here.
 */

export * from "./plans.types";
export * from "./plans.matrix";
export * from "./plans.limits";
export * from "./plans.data";
export * from "./plans.utils";
export * from "./plans.content";
