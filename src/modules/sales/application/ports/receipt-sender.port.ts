import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface ReceiptPortPayload {
  /** Nomor HP tujuan (format bebas; implementasi yang mengonversi ke format WhatsApp). */
  to: string;
  /** Isi pesan notifikasi/struk. */
  text: string;
}

/**
 * Port pengiriman notifikasi struk (WhatsApp dll). Implementasi saat ini:
 * WahaReceiptSender (WhatsApp HTTP API / WAHA — PRD 4.3); email menyusul.
 */
export interface IReceiptSender {
  send(payload: ReceiptPortPayload): Promise<Result<void, DomainError>>;
}
