import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";

export interface ExportStoreInfo {
  name: string;
  address: string;
  phone: string;
  footer: string;
}

export const FALLBACK_STORE: ExportStoreInfo = {
  name: "Toko",
  address: "",
  phone: "",
  footer: "",
};

/** Info toko untuk header ekspor; fallback bila pengaturan gagal dimuat. */
export async function loadExportStore(): Promise<ExportStoreInfo> {
  try {
    const container = await getAppContainer();
    const result = await container.settings.getStoreSettings.execute();
    if (isErr(result)) {
      return FALLBACK_STORE;
    }
    return {
      name: result.data.storeName,
      address: result.data.storeAddress,
      phone: result.data.storePhone,
      footer: result.data.receiptFooter,
    };
  } catch {
    return FALLBACK_STORE;
  }
}
