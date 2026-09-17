const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Real IANA zone names from the runtime's own Intl data (Intl.supportedValuesOf
 * is broadly supported in evergreen browsers/Node) -- falls back to a short
 * real-name list only where that API is unavailable, never a fabricated set.
 * "UTC" is prepended explicitly: it's this app's own default (see the
 * backend model and Settings config) but several runtimes' supportedValuesOf
 * omit the literal "UTC" in favor of "Etc/UTC", which would otherwise leave
 * a <select value="UTC"> silently falling back to whatever option sorts
 * first alphabetically. */
export function getSupportedTimezones(): string[] {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  let zones = FALLBACK_TIMEZONES;
  if (typeof supportedValuesOf === "function") {
    try {
      zones = supportedValuesOf("timeZone");
    } catch {
      // fall through to the static list below
    }
  }
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}
