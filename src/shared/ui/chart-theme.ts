import type { CSSProperties } from "react";

/**
 * Style tooltip chart (Recharts).
 *
 * Recharts memakai latar putih bawaan, sehingga tooltip menyala terang di
 * mode gelap. Konstanta ini menimpanya dengan token tema sehingga tooltip
 * ikut terang/gelap mengikuti mode yang sedang aktif.
 */
export const chartTooltipStyle: CSSProperties = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  color: "var(--popover-foreground)",
};
