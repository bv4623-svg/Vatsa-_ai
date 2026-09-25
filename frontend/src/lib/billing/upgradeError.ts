export interface UpgradeGateInfo {
  error: "upgrade_required" | "daily_limit_reached" | "app_limit_reached";
  feature: string;
  currentTier?: string;
  suggestedTier?: "pro" | "business";
  used?: number;
  limit?: number;
  message?: string;
}

export class UpgradeRequiredError extends Error {
  info: UpgradeGateInfo;
  constructor(info: UpgradeGateInfo) {
    super(info.message || (info.error === "daily_limit_reached" ? "Daily limit reached" : "Upgrade required"));
    this.info = info;
  }
}

const GATE_ERRORS = new Set(["upgrade_required", "daily_limit_reached", "app_limit_reached"]);

/** Parses a 402/403/429 response body from a feature/limit gate into an
 * UpgradeRequiredError, or returns null if the body isn't that shape. 403
 * covers app_limit_reached (see app/routers/conversations.py's code-app
 * cap); 402/429 cover the pre-existing feature-access/daily-limit gates. */
export async function parseUpgradeGate(response: Response): Promise<UpgradeRequiredError | null> {
  if (![402, 403, 429].includes(response.status)) return null;
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  if (!GATE_ERRORS.has(detail?.error)) return null;
  return new UpgradeRequiredError({
    error: detail.error,
    feature: detail.feature || "code_apps",
    currentTier: detail.current_tier,
    suggestedTier: detail.suggested_tier,
    used: detail.used,
    limit: detail.limit,
    message: detail.message,
  });
}
