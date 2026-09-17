/** Mirrors the to_dict() shapes of Backend's account models (ApiKey,
 * ConnectedAccount, Notification) and the account router responses. */

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  /** Only present in the response to the create call -- never stored or
   * shown again after this. */
  key: string;
}

export type ConnectionProvider = "google" | "github";

export interface ConnectedAccount {
  id: string;
  provider: ConnectionProvider;
  email: string | null;
  connectedAt: string;
}

export interface AccountNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  createdAt: string;
}

export interface Invoice {
  id: number;
  plan: string;
  status: string;
  verified: boolean;
  amount: string | null;
  currency: string;
  created_at: string | null;
  expires_at: string | null;
}

export interface BillingSummary {
  tier: string;
  invoices: Invoice[];
}

export interface TwoFactorSetup {
  secret: string;
  qrDataUri: string;
}

export interface TwoFactorEnableResult {
  enabled: boolean;
  backupCodes: string[];
}
