/**
 * Single source of truth for who runs the site. About, Contact, Terms,
 * Privacy and Refund all read from here, so the business name, address and
 * contact details Razorpay sees on every page are identical.
 *
 * The values live in business.json so scripts/check-business-info.js can
 * read the same data. Fill in `legalName`, `addressLines` and `phone`
 * before submitting the site for Razorpay verification -- until then the
 * pages fall back to the brand name and city, and the check script fails.
 */
import raw from "./business.json";

export interface BusinessConfig {
  brandName: string;
  /** Registered legal entity or proprietor, exactly as on the KYC documents. */
  legalName: string;
  /** Full postal address, one entry per line, including PIN code and country. */
  addressLines: string[];
  /** City, state and country -- shown when the full address is not set. */
  locality: string;
  /** International format, e.g. "+91 98765 43210". */
  phone: string;
  supportEmail: string;
  contactEmail: string;
  hours: string;
}

export const BUSINESS: BusinessConfig = raw;

export function legalName(): string {
  return BUSINESS.legalName.trim() || BUSINESS.brandName;
}

export function postalAddress(): string {
  const full = BUSINESS.addressLines.map((l) => l.trim()).filter(Boolean).join(", ");
  return full || BUSINESS.locality;
}

/** `tel:` href for the phone number, or null when none is configured. */
export function phoneHref(): string | null {
  const digits = BUSINESS.phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}
