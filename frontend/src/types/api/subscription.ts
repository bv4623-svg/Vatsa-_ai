export type Tier = "free" | "premium" | "pro";

export type Plan = {
  name: string;
  price_inr: number;
  daily_tokens: number;
  monthly_tokens: number;
  max_tokens_per_request: number;
  models: string[];
  attachments: boolean;
  tools: boolean;
  concurrent_requests: number;
};

export type Subscription = {
  tier: Tier;
  expires_at?: string;
};
