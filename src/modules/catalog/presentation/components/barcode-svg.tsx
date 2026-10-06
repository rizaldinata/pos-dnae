import { encodeBarcode } from "@/modules/catalog/domain/services/barcode";
import { cn } from "@/shared/lib/utils";

/**
 * Preview barcode (PRD-07): EAN-13 bila value valid, selain itu Code128.
 * Murni SVG tanpa dependensi — dipakai di form produk, halaman detail,
 * dan pratinjau label cetak.
 */
export function BarcodeSvg({
  value,
  className,
  showText = true,
}: {
  value: string;
  className?: string;
  /** Tampilkan teks nilai di bawah batang (untuk EAN-13 human-readable). */
  showText?: boolean;
}) {
  const encoded = encodeBarcode(value);
  if (!encoded) {
    return null;
  }

  const { modules, format } = encoded;
  // Quiet zone 10 modul di kiri/kanan sesuai spesifikasi.
  const quiet = 10;
  const totalWidth = modules.length + quiet * 2;
  const barHeight = 48;
  const textHeight = showText ? 14 : 0;
  const totalHeight = barHeight + textHeight;

  // Gabung run hitam berurutan jadi satu <rect> (lebih sedikit node).
  const rects: { x: number; width: number }[] = [];
  let runStart = -1;
  for (let i = 0; i <= modules.length; i += 1) {
    const black = i < modules.length && modules[i];
    if (black && runStart === -1) {
      runStart = i;
    } else if (!black && runStart !== -1) {
      rects.push({ x: quiet + runStart, width: i - runStart });
      runStart = -1;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={`Barcode ${value}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={totalWidth} height={totalHeight} fill="white" />
      {rects.map((rect) => (
        <rect
          key={rect.x}
          x={rect.x}
          y={0}
          width={rect.width}
          height={barHeight}
          fill="black"
        />
      ))}
      {showText && (
        <text
          x={totalWidth / 2}
          y={barHeight + 11}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={10}
          fill="black"
        >
          {value}
        </text>
      )}
      <title>{`${format.toUpperCase()}: ${value}`}</title>
    </svg>
  );
}
