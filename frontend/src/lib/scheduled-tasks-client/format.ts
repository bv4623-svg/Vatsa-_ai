const HAS_TZ_DESIGNATOR = /[Zz]|[+-]\d\d:\d\d$/;

/** Formats a UTC ISO timestamp from the backend into the given IANA
 * timezone (the viewer's own, from Settings) -- never the server's local
 * time and never a hardcoded offset.
 *
 * The backend's DateTime(timezone=True) columns are always UTC, but on
 * this app's SQLite database the offset is dropped on round-trip, so
 * to_dict()'s isoformat() comes back as e.g. "2026-09-18T09:00:00" with
 * no "Z"/offset suffix. Per the JS spec, `new Date()` treats a
 * timezone-less string as LOCAL time, not UTC -- so without normalizing
 * it first, this would silently show the wrong instant whenever the
 * viewer's system timezone isn't UTC. */
export function formatInTimezone(iso: string | null, timeZone: string): string {
  if (!iso) return "Never";
  const utcIso = HAS_TZ_DESIGNATOR.test(iso) ? iso : `${iso}Z`;
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(
      new Date(utcIso)
    );
  } catch {
    return new Date(utcIso).toLocaleString();
  }
}
