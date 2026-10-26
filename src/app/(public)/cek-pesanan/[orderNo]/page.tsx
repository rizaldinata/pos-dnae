import Link from "next/link";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/modules/orders/domain/entities/order";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { formatDateTimeJakarta } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { AutoRefresh } from "@/modules/orders/presentation/components/auto-refresh";
import { ProofUpload } from "@/modules/orders/presentation/components/storefront/proof-upload";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Status Pesanan",
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending:
    "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  confirmed: "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ready:
    "border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  completed:
    "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400",
};

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const [{ orderNo }, { phone }] = await Promise.all([params, searchParams]);

  if (!phone?.trim()) {
    return <NotFound message="Nomor HP diperlukan untuk mengecek pesanan." />;
  }

  const container = await getAppContainer();
  const result = await container.orders.getOrderStatus.execute(orderNo, phone);
  if (isErr(result)) {
    return <NotFound message={result.error.message} />;
  }

  const order = result.data;
  const settingsResult = await container.orders.getStorefrontSettings.execute();
  const qrisImage = isErr(settingsResult)
    ? ""
    : settingsResult.data.qrisImagePath;

  const showQris = order.paymentType === "qris" && order.status !== "cancelled";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <AutoRefresh seconds={20} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Status pesanan</h1>
        <Link href="/" className="text-sm underline">
          Pesan lagi
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{order.orderNo}</CardTitle>
            <Badge variant="outline" className={STATUS_CLASSES[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <CardDescription>
            {formatDateTimeJakarta(order.createdAt)} · {order.customerName}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Row
            label="Penerimaan"
            value={
              order.fulfillment === "pickup"
                ? "Ambil di toko"
                : "Kirim ke alamat"
            }
          />
          {order.fulfillment === "delivery" && order.address ? (
            <Row label="Alamat" value={order.address} />
          ) : null}
          {order.note ? <Row label="Catatan" value={order.note} /> : null}
          <Row
            label="Pembayaran"
            value={order.paymentType === "qris" ? "QRIS" : "Bayar di tempat"}
          />
          <Row
            label="Item"
            value={`${order.items.reduce((s, i) => s + i.qty, 0)} barang`}
          />
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatRupiah(order.total)}</span>
          </div>

          {order.status === "cancelled" ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
              Pesanan dibatalkan
              {order.cancelReason ? `: ${order.cancelReason}` : "."}
            </p>
          ) : null}

          {order.status === "completed" ? (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              Terima kasih sudah berbelanja!
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showQris ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pembayaran QRIS</CardTitle>
            <CardDescription>
              Scan kode di bawah ini, lalu unggah bukti pembayaran.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {qrisImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrisImage}
                alt="Kode QRIS toko"
                className="mx-auto max-h-64 rounded-md border bg-white p-2"
              />
            ) : (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Kode QRIS toko belum dipasang. Hubungi toko untuk alternatif
                pembayaran.
              </p>
            )}
            {order.paymentProofPath !== "" ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                Bukti pembayaran sudah dikirim — menunggu verifikasi staf.
              </p>
            ) : order.status === "pending" ? (
              <ProofUpload orderNo={order.orderNo} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-xl font-bold">Pesanan tidak ditemukan</h1>
      <p className="text-muted-foreground">{message}</p>
      <Link href="/cek-pesanan" className="underline">
        Coba lagi
      </Link>
    </div>
  );
}
