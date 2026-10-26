import type { ISaleRepository } from "@/modules/sales/domain/repositories/sale.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import type { IReceiptSender } from "@/modules/sales/application/ports/receipt-sender.port";
import { SaleNotFoundError } from "@/modules/sales/domain/errors";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";
import { formatRupiah } from "@/shared/lib/format-rupiah";

/** Jumlah baris item maksimal dalam pesan WhatsApp (struk tetap utuh di aplikasi). */
const MAX_ITEMS_IN_MESSAGE = 15;

/**
 * Kirim notifikasi struk WhatsApp ke no. HP pelanggan yang diinput kasir saat
 * checkout. Struk dimuat ulang dari database (sumber kebenaran), bukan dari
 * klien; pesan disusun server lalu dikirim lewat IReceiptSender (WAHA).
 */
export class SendReceiptNotificationUseCase {
  constructor(
    private readonly sales: ISaleRepository,
    private readonly settings: ISettingsRepository,
    private readonly sender: IReceiptSender
  ) {}

  public async execute(saleId: string): Promise<Result<void, DomainError>> {
    const receipt = await this.sales.findReceiptById(saleId);
    if (isErr(receipt)) {
      return err(receipt.error);
    }
    if (receipt.data === null) {
      return err(new SaleNotFoundError(saleId));
    }

    const { sale, items } = receipt.data;
    const phone = sale.customerPhone?.trim();
    if (!phone) {
      return err(
        new ValidationError("Transaksi ini tidak memiliki nomor HP pelanggan")
      );
    }

    let storeName = "Toko";
    const settings = await this.settings.getAll();
    if (!isErr(settings)) {
      const name = String(settings.data["store.name"] ?? "").trim();
      if (name) {
        storeName = name;
      }
    }

    return this.sender.send({
      to: phone,
      text: buildReceiptMessage(
        storeName,
        sale.invoiceNo,
        items.map((item) => ({
          qty: item.qty,
          productName: item.productName,
          subtotal: item.subtotal.amount,
        })),
        sale.grandTotal.amount
      ),
    });
  }
}

function buildReceiptMessage(
  storeName: string,
  invoiceNo: string,
  items: { qty: number; productName: string; subtotal: number }[],
  grandTotal: number
): string {
  const lines: string[] = [storeName, `Struk ${invoiceNo}`, ""];
  const shown = items.slice(0, MAX_ITEMS_IN_MESSAGE);
  for (const item of shown) {
    lines.push(
      `${item.qty}x ${item.productName} — ${formatRupiah(item.subtotal)}`
    );
  }
  if (items.length > shown.length) {
    lines.push(`…(+${items.length - shown.length} item lainnya)`);
  }
  lines.push(
    "",
    `Total ${formatRupiah(grandTotal)}`,
    "",
    "Terima kasih sudah berbelanja!"
  );
  return lines.join("\n");
}
