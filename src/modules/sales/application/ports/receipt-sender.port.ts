import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface ReceiptPortPayload {
  to: string;
  subject: string;
  receiptUrl: string;
}

/**
 * Port pengiriman struk (WhatsApp/email). Implementasi menyusul (PRD 4.3).
 */
export interface IReceiptSender {
  send(payload: ReceiptPortPayload): Promise<Result<void, DomainError>>;
}
