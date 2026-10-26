import type {
  IReceiptSender,
  ReceiptPortPayload,
} from "@/modules/sales/application/ports/receipt-sender.port";
import { ReceiptSendError } from "@/modules/sales/domain/errors";
import type { DomainError } from "@/shared/kernel/errors";
import { err, ok, type Result } from "@/shared/kernel/result";

export interface WahaConfig {
  /** Base URL WAHA, mis. http://localhost:3002 — kosong = belum dikonfigurasi. */
  baseUrl?: string | null;
  /** API key WAHA (header X-Api-Key); opsional untuk WAHA CE tanpa key. */
  apiKey?: string | null;
  /** Nama sesi WhatsApp; default "default". */
  session?: string | null;
}

/**
 * Konversi nomor HP apa pun (0812…, 812…, +62 812…, 62812…) ke chatId
 * WhatsApp. Awalan 0/8 lokal (Indonesia) dipetakan ke kode negara 62;
 * nomor internasional lain dibiarkan (hanya digit).
 */
export function toWaChatId(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }
  return `${digits}@c.us`;
}

/**
 * Pengirim notifikasi struk via WhatsApp HTTP API (WAHA).
 * POST {baseUrl}/api/sendText — { chatId, text, session } + header X-Api-Key.
 * Diinisialisasi dari env WAHA_URL / WAHA_API_KEY / WAHA_SESSION (lihat .env.example).
 */
export class WahaReceiptSender implements IReceiptSender {
  private readonly baseUrl: string | null;
  private readonly apiKey: string | null;
  private readonly session: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: WahaConfig, fetchFn: typeof fetch = fetch) {
    this.baseUrl = config.baseUrl?.trim().replace(/\/+$/, "") || null;
    this.apiKey = config.apiKey?.trim() || null;
    this.session = config.session?.trim() || "default";
    this.fetchFn = fetchFn;
  }

  public async send(
    payload: ReceiptPortPayload
  ): Promise<Result<void, DomainError>> {
    if (!this.baseUrl) {
      return err(
        new ReceiptSendError(
          "WhatsApp (WAHA) belum dikonfigurasi — isi WAHA_URL di .env.local"
        )
      );
    }
    if (!payload.to.trim()) {
      return err(new ReceiptSendError("Nomor HP tujuan kosong"));
    }

    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
        },
        body: JSON.stringify({
          chatId: toWaChatId(payload.to),
          text: payload.text,
          session: this.session,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return err(
          new ReceiptSendError(
            `WAHA menolak pengiriman (HTTP ${response.status})`
          )
        );
      }
      return ok(undefined);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      return err(new ReceiptSendError(`Gagal menghubungi WAHA: ${detail}`));
    }
  }
}
