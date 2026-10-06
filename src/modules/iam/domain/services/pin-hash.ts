import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 32;

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Hash PIN dengan scrypt (format: scrypt$salt$hash).
 */
export function hashPin(pin: string): string {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN harus 4-6 digit angka");
  }
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(pin, salt, KEY_BYTES).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) {
    return false;
  }
  const [algo, salt, expected] = stored.split("$");
  if (algo !== "scrypt" || !salt || !expected) {
    return false;
  }
  try {
    const actual = scryptSync(pin, salt, KEY_BYTES);
    const expectedBuf = Buffer.from(expected, "hex");
    return (
      actual.length === expectedBuf.length &&
      timingSafeEqual(actual, expectedBuf)
    );
  } catch {
    return false;
  }
}
