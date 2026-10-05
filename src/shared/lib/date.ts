export const TIMEZONE_JAKARTA = "Asia/Jakarta";
export const LOCALE_ID = "id-ID";

/**
 * Normalizes input date to Date object.
 */
function toDate(input: Date | string | number): Date {
  return typeof input === "object" && input instanceof Date
    ? input
    : new Date(input);
}

/**
 * Formats date using Asia/Jakarta timezone.
 */
export function formatDateJakarta(
  input: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = toDate(input);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE_JAKARTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options,
  };

  return new Intl.DateTimeFormat(LOCALE_ID, defaultOptions).format(date);
}

/**
 * Formats date and time: e.g. "05/10/2026 13.45"
 */
export function formatDateTimeJakarta(input: Date | string | number): string {
  return formatDateJakarta(input, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Formats date in human-readable Indonesian text: e.g. "5 Oktober 2026"
 */
export function formatDateReadableJakarta(
  input: Date | string | number
): string {
  return formatDateJakarta(input, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formats time: e.g. "13.45.00"
 */
export function formatTimeJakarta(input: Date | string | number): string {
  return formatDateJakarta(input, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Returns date string formatted as YYYY-MM-DD in Asia/Jakarta timezone.
 */
export function toISODateJakarta(
  input: Date | string | number = new Date()
): string {
  const date = toDate(input);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_JAKARTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}
