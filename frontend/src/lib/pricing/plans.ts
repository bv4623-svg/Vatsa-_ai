/**
 * Compatibility barrel.
 *
 * Plan data now lives in a single source of truth at src/data/plans.ts so
 * that /pricing and the in-app upgrade modal cannot drift apart. This path
 * is kept so any existing `@/lib/pricing/plans` import keeps resolving.
 */
export * from "@/data/plans";
