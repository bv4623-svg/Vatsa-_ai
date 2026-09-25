/** Mirrors Backend/app/services/feature_access.py's PROJECT_LIMITS, reused
 * by check_code_app_limit() for the /code workspace's "New Project" cap.
 * Client-side only for instant UI feedback (usage count, button label) --
 * POST /api/conversations enforces the real limit server-side regardless
 * of what this shows. */
export const CODE_APP_LIMITS: Record<string, number> = { free: 1, pro: 20, business: 200 };
