import type { DailyLimits, PlanId } from "./plans.types";

// Must stay in step with Backend app/services/feature_access.py DAILY_LIMITS
// and Backend app/services/storage_limits.py.
export const STORAGE_LIMIT_GB: Record<PlanId, number> = {
  free: 2,
  pro: 50,
  business: 500,
};

export const DAILY_LIMITS: Record<PlanId, DailyLimits> = {
  free:     { chat: null, codeApps: 1,   image: 5,   search: 5 },
  pro:      { chat: null, codeApps: 20,  image: 100, search: null },
  business: { chat: null, codeApps: 200, image: 500, search: null },
};
