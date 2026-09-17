/** Human-readable byte size, e.g. formatBytes(2147483648) -> "2 GB".
 * Used everywhere Library shows a real, DB-computed size -- never a
 * placeholder string. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? String(value) : value.toFixed(decimals);
  return `${formatted} ${units[exponent]}`;
}
