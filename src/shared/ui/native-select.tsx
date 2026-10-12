import * as React from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Select HTML native dengan chevron seragam untuk semua dropdown aplikasi.
 *
 * Panah native browser menempel di tepi kanan dan tidak bisa digeser lewat
 * padding, sehingga tampilannya dimatikan dan chevron digambar sendiri lewat
 * kelas `.native-select` (globals.css): ikon 16px, jarak 12px dari tepi
 * kanan — sepadan dengan padding kiri teks. Padding kanan dipaksa 2.25rem
 * via inline style supaya zona ikon tidak tertimpa kelas `px-*` milik
 * pemanggil.
 */
export function NativeSelect({
  className,
  style,
  ...props
}: React.ComponentPropsWithRef<"select">) {
  return (
    <select
      className={cn("native-select", className)}
      style={{ paddingRight: "2.25rem", ...style }}
      {...props}
    />
  );
}
