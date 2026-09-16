import type { User } from "@/stores/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  full_name?: string;
  tier?: string;
  profile_completed?: boolean;
  user: User;
}

async function parseJsonOrThrow(res: Response): Promise<any> {
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow(res);
}

export async function register(
  email: string,
  password: string,
  full_name?: string,
  verification_token?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name, verification_token }),
  });
  return parseJsonOrThrow(res);
}

export async function sendOtp(email: string, purpose: "signup" | "login" | "reset"): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose }),
  });
  return parseJsonOrThrow(res);
}

export async function resendOtp(email: string, purpose: "signup" | "login" | "reset"): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/otp/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose }),
  });
  return parseJsonOrThrow(res);
}

export interface VerifyOtpResponse {
  verified: boolean;
  reset_token?: string;
  verification_token?: string;
  access_token?: string;
  token_type?: string;
  full_name?: string;
  profile_completed?: boolean;
  user?: User;
}

export async function verifyOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
  const res = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  return parseJsonOrThrow(res);
}

export async function resetPassword(email: string, password: string, reset_token: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, reset_token }),
  });
  return parseJsonOrThrow(res);
}

export async function getMe(token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonOrThrow(res);
}

export async function completeOnboarding(
  token: string,
  birth_month: number,
  birth_year: number
): Promise<{ success: boolean; user: User }> {
  const res = await fetch(`${API_BASE}/auth/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ birth_month, birth_year }),
  });
  return parseJsonOrThrow(res);
}

export function oauthRedirectUrl(provider: "google" | "github" | "microsoft"): string {
  return `${API_BASE}/auth/${provider}/login`;
}
