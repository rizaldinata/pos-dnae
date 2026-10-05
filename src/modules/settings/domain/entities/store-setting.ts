export const STORE_SETTING_KEYS = [
  "store.name",
  "store.address",
  "store.phone",
  "store.logo_url",
  "receipt.footer",
] as const;

export type StoreSettingKey = (typeof STORE_SETTING_KEYS)[number];

export function isStoreSettingKey(key: string): key is StoreSettingKey {
  return (STORE_SETTING_KEYS as readonly string[]).includes(key);
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeLogoUrl: string;
  receiptFooter: string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "Toko DNAE",
  storeAddress: "Jl. Contoh No. 1, Jakarta",
  storePhone: "0812-0000-0000",
  storeLogoUrl: "",
  receiptFooter: "Terima kasih telah berbelanja.",
};

export function mapRecordToStoreSettings(
  record: Record<string, unknown>
): StoreSettings {
  const pick = (key: string, fallback: string): string => {
    const value = record[key];
    return typeof value === "string" ? value : fallback;
  };
  return {
    storeName: pick("store.name", DEFAULT_STORE_SETTINGS.storeName),
    storeAddress: pick("store.address", DEFAULT_STORE_SETTINGS.storeAddress),
    storePhone: pick("store.phone", DEFAULT_STORE_SETTINGS.storePhone),
    storeLogoUrl: pick("store.logo_url", DEFAULT_STORE_SETTINGS.storeLogoUrl),
    receiptFooter: pick("receipt.footer", DEFAULT_STORE_SETTINGS.receiptFooter),
  };
}
