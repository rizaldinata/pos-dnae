export interface FormatRupiahOptions {
  withPrefix?: boolean;
  spaceAfterPrefix?: boolean;
}

/**
 * Format an integer or numeric amount to Indonesian Rupiah representation.
 * Example: 1000000 -> "Rp 1.000.000"
 */
export function formatRupiah(
  amount: number,
  options: FormatRupiahOptions = {}
): string {
  const { withPrefix = true, spaceAfterPrefix = true } = options;

  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(Math.round(amount));

  // Format with thousand separators (dots)
  const formattedNumber = absoluteAmount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (!withPrefix) {
    return isNegative ? `-${formattedNumber}` : formattedNumber;
  }

  const prefix = spaceAfterPrefix ? "Rp " : "Rp";
  return isNegative
    ? `-${prefix}${formattedNumber}`
    : `${prefix}${formattedNumber}`;
}

/**
 * Parses a Rupiah string or formatted number into an integer number.
 * Example: "Rp 1.000.000" -> 1000000
 */
export function parseRupiah(input: string): number {
  if (!input) return 0;
  const isNegative = input.includes("-");
  const cleaned = input.replace(/[^0-9]/g, "");
  const value = parseInt(cleaned, 10);

  if (isNaN(value)) {
    return 0;
  }

  return isNegative ? -value : value;
}
