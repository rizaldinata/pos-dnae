"use client";

import { useState, useTransition } from "react";
import {
  updateStoreSettingsAction,
  uploadStoreLogoAction,
  type SettingsActionState,
} from "@/modules/settings/presentation/actions/settings.action";
import type { StoreSettings } from "@/modules/settings/domain/entities/store-setting";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ReceiptPreview } from "@/modules/sales/presentation/components/receipt-preview";
import type { ReceiptDTO } from "@/modules/sales/presentation/actions/checkout.action";

const initialState: SettingsActionState = { success: false, message: null };

const SAMPLE_RECEIPT: ReceiptDTO = {
  saleId: "sample",
  invoiceNo: "INV-20261005-0001",
  status: "completed",
  createdAt: new Date().toISOString(),
  cashierName: "Kasir",
  subtotal: 10000,
  discountTotal: 0,
  grandTotal: 10000,
  paidTotal: 10000,
  changeAmount: 0,
  items: [
    {
      productName: "Contoh Produk",
      sku: "CTH-1",
      qty: 2,
      unitPrice: 5000,
      discount: 0,
      subtotal: 10000,
    },
  ],
  payments: [
    {
      paymentMethodName: "Tunai",
      paymentMethodType: "cash",
      amount: 10000,
      referenceNo: null,
    },
  ],
};

export function StoreSettingsForm({ initial }: { initial: StoreSettings }) {
  const [state, setState] = useState<SettingsActionState>(initialState);
  const [pending, startTransition] = useTransition();
  const [uploading, startUploading] = useTransition();
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [storeName, setStoreName] = useState(initial.storeName);
  const [storeAddress, setStoreAddress] = useState(initial.storeAddress);
  const [storePhone, setStorePhone] = useState(initial.storePhone);
  const [storeLogoUrl, setStoreLogoUrl] = useState(initial.storeLogoUrl);
  const [receiptFooter, setReceiptFooter] = useState(initial.receiptFooter);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("storeName", storeName);
    formData.set("storeAddress", storeAddress);
    formData.set("storePhone", storePhone);
    formData.set("storeLogoUrl", storeLogoUrl);
    formData.set("receiptFooter", receiptFooter);
    startTransition(async () => {
      const result = await updateStoreSettingsAction(initialState, formData);
      setState(result);
    });
  }

  function handleLogoChange(file: File | undefined) {
    if (!file) {
      return;
    }
    const formData = new FormData();
    formData.set("logo", file);
    startUploading(async () => {
      const result = await uploadStoreLogoAction(formData);
      if (result.success && result.url) {
        setStoreLogoUrl(result.url);
        setUploadMessage("Logo berhasil diunggah");
      } else {
        setUploadMessage(result.message);
      }
    });
  }

  const inputClass = "min-h-11";
  const labelClass = "text-sm font-medium";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Info toko</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="store-name" className={labelClass}>
                Nama toko
              </label>
              <Input
                id="store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                disabled={pending}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="store-address" className={labelClass}>
                Alamat
              </label>
              <Input
                id="store-address"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                disabled={pending}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="store-phone" className={labelClass}>
                Telepon
              </label>
              <Input
                id="store-phone"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                disabled={pending}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className={labelClass}>Logo</span>
              {storeLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storeLogoUrl}
                  alt="Logo toko"
                  className="h-16 w-16 rounded-md border object-contain"
                />
              )}
              <Input
                id="store-logo"
                type="file"
                accept="image/*"
                disabled={pending || uploading}
                onChange={(e) => handleLogoChange(e.target.files?.[0])}
              />
              {uploadMessage && (
                <p className="text-xs text-muted-foreground">{uploadMessage}</p>
              )}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="store-logo-url"
                  className="text-xs text-muted-foreground"
                >
                  atau tempel URL logo
                </label>
                <Input
                  id="store-logo-url"
                  value={storeLogoUrl}
                  onChange={(e) => setStoreLogoUrl(e.target.value)}
                  disabled={pending}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="receipt-footer" className={labelClass}>
                Footer struk
              </label>
              <textarea
                id="receipt-footer"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                disabled={pending}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {state.message && (
              <p
                role={state.success ? "status" : "alert"}
                className={`text-sm ${state.success ? "text-green-600" : "text-destructive"}`}
              >
                {state.message}
              </p>
            )}
            <Button
              type="submit"
              disabled={pending}
              loading={pending}
              className="min-h-11"
            >
              {pending ? "Menyimpan..." : "Simpan pengaturan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pratinjau struk</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceiptPreview
            receipt={SAMPLE_RECEIPT}
            store={{
              name: storeName || "Toko DNAE",
              address: storeAddress,
              phone: storePhone,
              footer: receiptFooter,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
