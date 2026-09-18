import type { DailyLimits, PlanId } from "./plans.types";

// Must stay in step with Backend app/services/feature_access.py DAILY_LIMITS
// and Backend app/services/storage_limits.py.
export const STORAGE_LIMIT_GB: Record<PlanId, number> = {
  free: 2,
  pro: 50,
  business: 500,
};

export const DAILY_LIMITS: Record<PlanId, DailyLimits> = {
  free:     { chat: 25,   code: 3,   image: 20,  search: 5 },
  pro:      { chat: 2000, code: 500, image: 200, search: 500 },
  business: { chat: 2000, code: 500, image: 200, search: 500 },
};
