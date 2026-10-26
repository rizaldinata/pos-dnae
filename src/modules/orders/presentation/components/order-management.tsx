"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { formatDateTimeJakarta } from "@/shared/lib/date";
import {
  ORDER_STATUS_LABELS,
  nextStatuses,
  type OrderStatus,
} from "@/modules/orders/domain/entities/order";
import {
  cancelOrderAction,
  getOrderDetailAction,
  listOrdersAction,
  updateOrderStatusAction,
  type ListOrdersState,
  type OrderDetailDTO,
} from "@/modules/orders/presentation/actions/order.action";

const STATUS_FILTERS: { value: OrderStatus | null; label: string }[] = [
  { value: null, label: "Semua" },
  { value: "pending", label: ORDER_STATUS_LABELS.pending },
  { value: "confirmed", label: ORDER_STATUS_LABELS.confirmed },
  { value: "ready", label: ORDER_STATUS_LABELS.ready },
  { value: "completed", label: ORDER_STATUS_LABELS.completed },
  { value: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
];

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

const NEXT_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Terima pesanan",
  confirmed: "Tandai siap",
  ready: "Selesaikan",
  completed: "",
  cancelled: "",
};

const EMPTY_LIST: ListOrdersState = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
};

/** Halaman staf: daftar + proses pesanan online (ubah status / batalkan). */
export function OrderManagement() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListOrdersState>(EMPTY_LIST);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetailDTO | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await listOrdersAction({
        status: statusFilter,
        search: search.trim() || null,
        page,
      });
      setData(result);
      if (!result.success && result.message) {
        setNotice(result.message);
      }
    });
  }, [statusFilter, search, page]);

  // Muat awal + setelah pencarian/ubah filter.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Perbarui berkala (pesanan baru datang tanpa refresh manual).
  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
    }, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  function openDetail(orderId: string) {
    setDetailId(orderId);
    setDetail(null);
    setCancelMode(false);
    setCancelReason("");
    startTransition(async () => {
      const result = await getOrderDetailAction(orderId);
      if (result.success && result.order) {
        setDetail(result.order);
      } else {
        setNotice(result.message);
        setDetailId(null);
      }
    });
  }

  function reloadDetail(orderId: string) {
    startTransition(async () => {
      const result = await getOrderDetailAction(orderId);
      setDetail(result.success && result.order ? result.order : null);
    });
  }

  function handleAdvance() {
    if (!detail || actionPending) {
      return;
    }
    const current = detail;
    setActionPending(true);
    void (async () => {
      const next = nextStatuses(current.status).find((s) => s !== "cancelled");
      if (!next) {
        setActionPending(false);
        return;
      }
      const result = await updateOrderStatusAction({
        orderId: current.id,
        expectedStatus: current.status,
        nextStatus: next,
      });
      setActionPending(false);
      setNotice(result.message);
      if (result.success) {
        refresh();
        reloadDetail(current.id);
      }
    })();
  }

  function handleCancel() {
    if (!detail || actionPending) {
      return;
    }
    const current = detail;
    setActionPending(true);
    void (async () => {
      const result = await cancelOrderAction({
        orderId: current.id,
        reason: cancelReason,
      });
      setActionPending(false);
      setNotice(result.message);
      if (result.success) {
        setCancelMode(false);
        setCancelReason("");
        refresh();
        reloadDetail(current.id);
      }
    })();
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const next =
    detail && detail.status !== "completed" && detail.status !== "cancelled"
      ? (nextStatuses(detail.status).find((s) => s !== "cancelled") ?? null)
      : null;
  const cancellable =
    detail !== null &&
    detail.status !== "completed" &&
    detail.status !== "cancelled";

  return (
    <div className="flex flex-col gap-4">
      {/* Judul baris sendiri */}
      <div>
        <h1 className="text-xl font-semibold">Pesanan</h1>
        <p className="text-sm text-muted-foreground">
          Pesanan masuk dari halaman publik toko — {data.total} pesanan
        </p>
      </div>

      {/* Toolbar: filter kiri + aksi kanan */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            onClick={() => {
              setStatusFilter(filter.value);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              statusFilter === filter.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Cari no. pesanan / nama / HP..."
          aria-label="Cari pesanan"
          className="min-h-10 w-64"
        />
        <Button
          variant="outline"
          className="min-h-10 ml-auto"
          onClick={refresh}
          disabled={pending}
        >
          {pending ? "Memuat..." : "Muat ulang"}
        </Button>
      </div>

      {notice ? (
        <p
          role="alert"
          className="rounded-md border border-border bg-muted/40 p-3 text-sm"
        >
          {notice}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setNotice(null)}
          >
            tutup
          </button>
        </p>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. pesanan</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead className="text-right">Item</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Bayar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.orderNo}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTimeJakarta(order.createdAt)}
                </TableCell>
                <TableCell>
                  <p>{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customerPhone}
                  </p>
                </TableCell>
                <TableCell className="text-right">{order.totalQty}</TableCell>
                <TableCell className="text-right">
                  {formatRupiah(order.total)}
                </TableCell>
                <TableCell>
                  <span className="text-sm uppercase">{order.paymentType}</span>
                  {order.hasProof ? (
                    <Badge variant="outline" className="ml-2">
                      ada bukti
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={STATUS_CLASSES[order.status]}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    onClick={() => openDetail(order.id)}
                  >
                    Detail
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  {pending ? "Memuat pesanan..." : "Tidak ada pesanan."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Halaman {data.page} dari {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-9"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-9"
              disabled={data.page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}

      {/* Dialog detail */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDetail(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.orderNo}
                  <Badge
                    variant="outline"
                    className={STATUS_CLASSES[detail.status]}
                  >
                    {ORDER_STATUS_LABELS[detail.status]}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {formatDateTimeJakarta(detail.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3 text-sm">
                <InfoRow label="Pelanggan" value={detail.customerName} />
                <InfoRow label="No. HP" value={detail.customerPhone} />
                <InfoRow
                  label="Penerimaan"
                  value={
                    detail.fulfillment === "pickup"
                      ? "Ambil di toko"
                      : "Kirim ke alamat"
                  }
                />
                {detail.fulfillment === "delivery" && detail.address ? (
                  <InfoRow label="Alamat" value={detail.address} />
                ) : null}
                {detail.note ? (
                  <InfoRow label="Catatan" value={detail.note} />
                ) : null}
                <InfoRow
                  label="Pembayaran"
                  value={
                    detail.paymentType === "qris"
                      ? "QRIS"
                      : "Bayar di tempat (tunai)"
                  }
                />
                {detail.status === "cancelled" && detail.cancelReason ? (
                  <InfoRow label="Alasan batal" value={detail.cancelReason} />
                ) : null}

                {/* Item */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Harga</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item) => (
                        <TableRow key={item.variantId}>
                          <TableCell>
                            {item.productName}
                            {item.variantName !== item.productName
                              ? ` — ${item.variantName}`
                              : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.qty}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatRupiah(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatRupiah(item.lineTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between border-t pt-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">
                    {formatRupiah(detail.total)}
                  </span>
                </div>

                {/* Bukti bayar QRIS */}
                {detail.paymentType === "qris" ? (
                  <div className="flex flex-col gap-2">
                    <p className="font-medium">Bukti pembayaran</p>
                    {detail.proofUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detail.proofUrl}
                        alt={`Bukti bayar ${detail.orderNo}`}
                        className="max-h-80 rounded-md border object-contain"
                      />
                    ) : (
                      <p className="text-muted-foreground">
                        {detail.hasProof
                          ? "Bukti sudah diunggah pelanggan (gagal dimuat)."
                          : "Pelanggan belum mengunggah bukti."}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Aksi status */}
                {next || cancellable ? (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    {actionPending ? (
                      <p className="text-sm text-muted-foreground">
                        Memproses...
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {next ? (
                        <Button
                          className="min-h-11"
                          disabled={actionPending}
                          onClick={handleAdvance}
                        >
                          {NEXT_STATUS_LABELS[detail.status]}
                        </Button>
                      ) : null}
                      {cancellable ? (
                        <Button
                          variant="destructive"
                          className="min-h-11"
                          disabled={actionPending}
                          onClick={() => setCancelMode((v) => !v)}
                        >
                          Batalkan pesanan
                        </Button>
                      ) : null}
                    </div>
                    {cancelMode ? (
                      <div className="flex flex-col gap-2 rounded-md border p-3">
                        <label
                          htmlFor="cancel-reason"
                          className="text-sm font-medium"
                        >
                          Alasan pembatalan{" "}
                          <span className="text-muted-foreground">
                            (opsional — stok otomatis dikembalikan)
                          </span>
                        </label>
                        <Input
                          id="cancel-reason"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          maxLength={300}
                          placeholder="Mis. stok habis"
                          className="min-h-10"
                        />
                        <Button
                          variant="destructive"
                          className="min-h-10 w-fit"
                          disabled={actionPending}
                          onClick={handleCancel}
                        >
                          Konfirmasi batal
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              Memuat detail pesanan...
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
