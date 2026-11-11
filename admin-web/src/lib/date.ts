/**
 * Deterministic Indian Standard Time (IST, UTC+05:30) Date & Time Formatting Utilities
 * Standardized for Kalasalingam Academy of Research and Education (KARE).
 * 
 * Prevents Next.js SSR / Client Hydration Mismatches and eliminates server timezone
 * discrepancy (e.g. UTC cloud/container servers vs Indian Standard Time).
 */

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Indian Standard Time is UTC + 5 hours 30 minutes (+330 minutes, no Daylight Saving Time)
export const IST_OFFSET_MINUTES = 330;
export const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000; // 19,800,000 ms

/**
 * Parses date string, number, or Date into a valid Date object.
 * Strings without timezone offsets (e.g. "YYYY-MM-DDTHH:mm") are parsed as IST.
 */
export function parseDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (typeof input === "object" && input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();
  if (!str) return null;

  // If matches datetime-local pattern (YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm:ss) with no TZ suffix
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
    const norm = str.replace(" ", "T");
    const withSec = norm.length === 16 ? `${norm}:00` : norm;
    const d = new Date(`${withSec}+05:30`);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses user/form inputs representing Indian Standard Time into an authoritative Date.
 */
export function parseISTDateTime(input: string | number | Date | null | undefined): Date {
  const d = parseDate(input);
  return d || new Date();
}

/**
 * Returns a new Date object shifted to Indian Standard Time (IST),
 * where getUTCDate, getUTCMonth, getUTCFullYear, getUTCHours, getUTCMinutes, getUTCSeconds
 * yield the exact IST calendar and clock values regardless of host machine timezone.
 */
export function toISTDate(input: string | number | Date | null | undefined): Date | null {
  const d = parseDate(input);
  if (!d) return null;
  return new Date(d.getTime() + IST_OFFSET_MS);
}

/**
 * Returns deterministic date format in IST: "11 Nov 2026"
 */
export function formatDate(input: string | number | Date | null | undefined): string {
  const ist = toISTDate(input);
  if (!ist) return "—";
  const day = ist.getUTCDate().toString().padStart(2, "0");
  const month = MONTHS[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Returns deterministic time format in IST: "02:00 PM" or "02:00:15 PM IST"
 */
export function formatTime(
  input: string | number | Date | null | undefined,
  includeSeconds = false,
  includeTimezone = false
): string {
  const ist = toISTDate(input);
  if (!ist) return "—";
  let hours = ist.getUTCHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const mins = ist.getUTCMinutes().toString().padStart(2, "0");
  const tzSuffix = includeTimezone ? " IST" : "";

  if (includeSeconds) {
    const secs = ist.getUTCSeconds().toString().padStart(2, "0");
    return `${hours.toString().padStart(2, "0")}:${mins}:${secs} ${ampm}${tzSuffix}`;
  }
  return `${hours.toString().padStart(2, "0")}:${mins} ${ampm}${tzSuffix}`;
}

/**
 * Returns deterministic date and time format in IST: "11 Nov 2026, 02:00 PM IST"
 */
export function formatDateTime(
  input: string | number | Date | null | undefined,
  includeSeconds = false,
  includeTimezone = true
): string {
  const d = parseDate(input);
  if (!d) return "—";
  return `${formatDate(d)}, ${formatTime(d, includeSeconds, includeTimezone)}`;
}

/**
 * Formats a Date/ISO string to "YYYY-MM-DDTHH:mm" in IST for HTML <input type="datetime-local">.
 */
export function formatToISTDateTimeLocal(input: string | number | Date | null | undefined): string {
  const ist = toISTDate(input);
  if (!ist) return "";
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  const hours = String(ist.getUTCHours()).padStart(2, "0");
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Returns current or given server time formatted as Indian Standard Time (IST):
 * e.g. "11 Nov 2026, 02:15:30 PM IST"
 */
export function formatServerIST(
  epochMs?: number | Date | null,
  includeSeconds = true
): string {
  const d = epochMs ? parseDate(epochMs) : new Date();
  return formatDateTime(d, includeSeconds, true);
}

/**
 * Formats duration in minutes to human readable string: e.g. "1 hr 30 mins"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs} hr ${rem} mins` : `${hrs} hrs`;
}
