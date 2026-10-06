/**
 * Generate & encode barcode (PRD-07, Sub-PRD 4.2) — murni, tanpa dependensi.
 *
 * - EAN-13: check digit, generator angka acak valid, dan encoding modul
 *   (95 modul) memakai tabel L/G/R + parity digit pertama.
 * - Code128: encoder Code B (cukup untuk SKU/barcode toko, ASCII 32–126),
 *   checksum modulo 103, tabel pola ZXing Code128Reader.CODE_PATTERNS.
 *
 * Tabel & algoritma diverifikasi dari referensi ZXing (Apache-2.0):
 * EAN13Reader / EAN13Writer / UPCEANReader / Code128Reader / Code128Writer.
 */

/** Lebar modul (bar, space, bar, space) per digit — kode "L" (odd). */
const EAN_L_WIDTHS = [
  "3211",
  "2221",
  "2122",
  "1411",
  "1132",
  "1231",
  "1114",
  "1312",
  "1213",
  "3112",
] as const;

/** Kode "G" (even) = kebalikan urutan lebar L. */
const EAN_G_WIDTHS = EAN_L_WIDTHS.map((w) => w.split("").reverse().join(""));

/** Parity digit pertama: bit 1 = G (even), bit 0 = L (odd); bit ke-i → posisi i. */
const EAN_FIRST_DIGIT_ENCODINGS = [
  0x00, 0x0b, 0x0d, 0xe, 0x13, 0x19, 0x1c, 0x15, 0x16, 0x1a,
] as const;

/** Lebar run start/end guard (bar-space-bar): 3 run × 1 modul → "101". */
const EAN_START_END = "111";
/** Lebar run middle guard: 5 run × 1 modul, mulai space → "01010". */
const EAN_MIDDLE = "11111";

/**
 * Check digit EAN-13/UPC-A untuk 12 digit pertama.
 * Bobot: posisi ganjil (1-based) ×1, genap ×3; check = (1000 − Σ) % 10.
 */
export function ean13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error("EAN-13 check digit butuh tepat 12 digit angka");
  }
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(twelveDigits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (1000 - sum) % 10;
}

/** Apakah value adalah EAN-13 valid (13 digit + check digit cocok)? */
export function isEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }
  return ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}

/**
 * Generate barcode EAN-13 baru. Prefix "2" = penggunaan internal toko
 * (prefix 20–29 dipakai untuk item in-store), 11 digit acak + check digit.
 */
export function generateEan13(random: () => number = Math.random): string {
  let body = "2";
  for (let i = 0; i < 11; i += 1) {
    body += String(Math.floor(random() * 10));
  }
  return body + String(ean13CheckDigit(body));
}

function runToModules(
  widths: string,
  startBlack: boolean,
  out: boolean[]
): void {
  let black = startBlack;
  for (const ch of widths) {
    const width = Number(ch);
    for (let k = 0; k < width; k += 1) {
      out.push(black);
    }
    black = !black;
  }
}

/** Encode EAN-13 (harus 13 digit valid) menjadi 95 modul hitam/putih. */
export function encodeEan13(value: string): boolean[] {
  if (!isEan13(value)) {
    throw new Error(`Nilai bukan EAN-13 valid: ${value}`);
  }

  const modules: boolean[] = [];
  runToModules(EAN_START_END, true, modules);

  const parity = EAN_FIRST_DIGIT_ENCODINGS[Number(value[0])] ?? 0;
  for (let i = 1; i <= 6; i += 1) {
    const digit = Number(value[i]);
    const useG = (parity >> (6 - i)) & 1;
    const widths = (useG ? EAN_G_WIDTHS : EAN_L_WIDTHS)[digit] ?? "1111111";
    // Sisi kiri: pola dimulai dari space (startWithBlack = false).
    runToModules(widths, false, modules);
  }

  runToModules(EAN_MIDDLE, false, modules);

  for (let i = 7; i <= 12; i += 1) {
    // Sisi kanan: pola L dimulai dari bar → menghasilkan kode R.
    runToModules(EAN_L_WIDTHS[Number(value[i])] ?? "1111111", true, modules);
  }

  runToModules(EAN_START_END, true, modules);
  return modules;
}

/** Pola lebar (bar, space, ...) per nilai simbol Code128 — ZXing CODE_PATTERNS. */
const CODE128_PATTERNS: readonly string[] = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

const CODE128_START_B = 104;
const CODE128_STOP = 106;

/**
 * Encode Code128 (kode set B) menjadi modul hitam/putih.
 * Karakter di luar ASCII 32–126 diganti "?" (tidak bisa dikodekan di Code B).
 */
export function encodeCode128(value: string): boolean[] {
  const text = value.replace(/[^\x20-\x7e]/g, "?");
  if (text.length === 0) {
    throw new Error("Code128 butuh minimal 1 karakter");
  }

  const codes: number[] = [CODE128_START_B];
  for (const ch of text) {
    codes.push(ch.charCodeAt(0) - 32);
  }

  // Checksum: Σ (nilai simbol × posisi), posisi dimulai 1 pada simbol data
  // pertama; start code berbobot 1.
  let checksum = CODE128_START_B;
  for (let i = 1; i < codes.length; i += 1) {
    checksum += (codes[i] ?? 0) * i;
  }
  codes.push(checksum % 103);
  codes.push(CODE128_STOP);

  const modules: boolean[] = [];
  for (const code of codes) {
    runToModules(CODE128_PATTERNS[code] ?? "212222", true, modules);
  }
  return modules;
}

export type BarcodeFormat = "ean13" | "code128";

export interface EncodedBarcode {
  modules: boolean[];
  format: BarcodeFormat;
}

/**
 * Encode nilai barcode untuk preview: EAN-13 bila valid, selain itu Code128.
 * Mengembalikan null untuk value kosong.
 */
export function encodeBarcode(value: string): EncodedBarcode | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (isEan13(trimmed)) {
    return { modules: encodeEan13(trimmed), format: "ean13" };
  }
  return { modules: encodeCode128(trimmed), format: "code128" };
}
