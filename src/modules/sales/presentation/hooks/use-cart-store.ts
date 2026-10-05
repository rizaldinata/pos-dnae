"use client";

import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";
import type { POSVariant } from "@/modules/sales/application/use-cases/search-products-pos.use-case";
import { CartItem } from "@/modules/sales/domain/entities/cart-item";
import {
  Discount,
  type DiscountKind,
} from "@/modules/sales/domain/value-objects/discount";
import { DiscountPolicy } from "@/modules/sales/domain/services/discount-policy";
import { Money } from "@/shared/lib/money";

export interface CartItemData {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  costPrice: number;
  stockQty: number | null;
  trackStock: boolean;
  itemDiscount: { kind: DiscountKind; value: number } | null;
}

export interface DiscountData {
  kind: DiscountKind;
  value: number;
}

interface CartState {
  items: CartItemData[];
  transactionDiscount: DiscountData | null;
  roleName: string;
  setRole: (roleName: string) => void;
  addItem: (variant: POSVariant) => string | null;
  setQty: (variantId: string, qty: number) => string | null;
  removeItem: (variantId: string) => void;
  setItemDiscount: (
    variantId: string,
    discount: DiscountData | null
  ) => string | null;
  setTransactionDiscount: (discount: DiscountData | null) => string | null;
  clearCart: () => void;
}

function toDiscount(data: DiscountData | null): Discount | null {
  if (!data) {
    return null;
  }
  try {
    return data.kind === "percent"
      ? Discount.percent(data.value)
      : Discount.amount(data.value);
  } catch {
    return null;
  }
}

export function toCartItemEntities(items: CartItemData[]): CartItem[] {
  return items.map((item) =>
    CartItem.create({
      variantId: item.variantId,
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      qty: item.qty,
      unitPrice: Money.create(item.unitPrice),
      costPrice: Money.create(item.costPrice),
      stockQty: item.stockQty,
      trackStock: item.trackStock,
      discount: toDiscount(item.itemDiscount),
      note: "",
    })
  );
}

function checkStock(item: CartItemData, newQty: number): string | null {
  if (!item.trackStock || item.stockQty === null) {
    return null;
  }
  if (newQty > item.stockQty) {
    return `Stok tidak cukup (sisa ${item.stockQty})`;
  }
  return null;
}

const serverSafeStorage: StateStorage = {
  getItem: (key) =>
    typeof window === "undefined" ? null : sessionStorage.getItem(key),
  setItem: (key, value) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(key);
    }
  },
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      transactionDiscount: null,
      roleName: "Kasir",

      setRole: (roleName) => set({ roleName }),

      addItem: (variant) => {
        const existing = get().items.find(
          (i) => i.variantId === variant.variantId
        );
        if (existing) {
          return get().setQty(variant.variantId, existing.qty + 1);
        }
        const data: CartItemData = {
          variantId: variant.variantId,
          productId: variant.productId,
          productName: variant.productName,
          variantName: variant.variantName,
          sku: variant.sku,
          qty: 1,
          unitPrice: variant.sellPrice,
          costPrice: variant.costPrice,
          stockQty: variant.stockQty,
          trackStock: variant.trackStock,
          itemDiscount: null,
        };
        const stockError = checkStock(data, 1);
        if (stockError) {
          return stockError;
        }
        set({ items: [...get().items, data] });
        return null;
      },

      setQty: (variantId, qty) => {
        if (!Number.isFinite(qty) || qty <= 0) {
          return "Qty harus lebih dari 0";
        }
        const item = get().items.find((i) => i.variantId === variantId);
        if (!item) {
          return "Item tidak ditemukan di keranjang";
        }
        const stockError = checkStock(item, Math.floor(qty));
        if (stockError) {
          return stockError;
        }
        set({
          items: get().items.map((i) =>
            i.variantId === variantId ? { ...i, qty: Math.floor(qty) } : i
          ),
        });
        return null;
      },

      removeItem: (variantId) =>
        set({ items: get().items.filter((i) => i.variantId !== variantId) }),

      setItemDiscount: (variantId, discount) => {
        if (discount && discount.kind === "percent") {
          const max = DiscountPolicy.maxPercentForRole(get().roleName);
          if (discount.value > max) {
            return `Diskon maksimal ${max}% untuk role ${get().roleName}`;
          }
        }
        set({
          items: get().items.map((i) =>
            i.variantId === variantId ? { ...i, itemDiscount: discount } : i
          ),
        });
        return null;
      },

      setTransactionDiscount: (discount) => {
        if (discount && discount.kind === "percent") {
          const max = DiscountPolicy.maxPercentForRole(get().roleName);
          if (discount.value > max) {
            return `Diskon maksimal ${max}% untuk role ${get().roleName}`;
          }
        }
        set({ transactionDiscount: discount });
        return null;
      },

      clearCart: () => set({ items: [], transactionDiscount: null }),
    }),
    {
      name: "pos-cart",
      storage: createJSONStorage(() => serverSafeStorage),
      partialize: (state) => ({
        items: state.items,
        transactionDiscount: state.transactionDiscount,
      }),
    }
  )
);
