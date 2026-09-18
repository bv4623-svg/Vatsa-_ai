export interface UpgradeGateInfo {
  error: "upgrade_required" | "daily_limit_reached";
  feature: string;
  currentTier?: string;
  suggestedTier?: "pro" | "business";
  used?: number;
  limit?: number;
}

export class UpgradeRequiredError extends Error {
  info: UpgradeGateInfo;
  constructor(info: UpgradeGateInfo) {
    super(info.error === "daily_limit_reached" ? "Daily limit reached" : "Upgrade required");
    this.info = info;
  }
}

/** Parses a 402/429 response body from the feature_access gate into an
 * UpgradeRequiredError, or returns null if the body isn't that shape. */
export async function parseUpgradeGate(response: Response): Promise<UpgradeRequiredError | null> {
  if (response.status !== 402 && response.status !== 429) return null;
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  if (detail?.error !== "upgrade_required" && detail?.error !== "daily_limit_reached") return null;
  return new UpgradeRequiredError({
    error: detail.error,
    feature: detail.feature,
    currentTier: detail.current_tier,
    suggestedTier: detail.suggested_tier,
    used: detail.used,
    limit: detail.limit,
  });
}
