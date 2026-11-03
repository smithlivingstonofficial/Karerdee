/**
 * Deterministic Date & Time Formatting Utilities
 * Prevents Next.js SSR / Client Hydration Mismatches by avoiding
 * locale-dependent formatting on initial server renders.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Parses date string, number, or Date into a valid Date object.
 */
function parseDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  const d = typeof input === "object" && input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns deterministic date format: "02 Nov 2026"
 */
export function formatDate(input: string | number | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return "—";
  const day = d.getDate().toString().padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Returns deterministic time format: "10:30:15 AM"
 */
export function formatTime(input: string | number | Date | null | undefined, includeSeconds = false): string {
  const d = parseDate(input);
  if (!d) return "—";
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const mins = d.getMinutes().toString().padStart(2, "0");
  if (includeSeconds) {
    const secs = d.getSeconds().toString().padStart(2, "0");
    return `${hours.toString().padStart(2, "0")}:${mins}:${secs} ${ampm}`;
  }
  return `${hours.toString().padStart(2, "0")}:${mins} ${ampm}`;
}

/**
 * Returns deterministic date and time format: "02 Nov 2026, 10:30 AM"
 */
export function formatDateTime(input: string | number | Date | null | undefined, includeSeconds = false): string {
  const d = parseDate(input);
  if (!d) return "—";
  return `${formatDate(d)}, ${formatTime(d, includeSeconds)}`;
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

