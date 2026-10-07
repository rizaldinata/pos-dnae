export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          new_value: Json | null;
          old_value: Json | null;
          record_id: string | null;
          table_name: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          record_id?: string | null;
          table_name?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          record_id?: string | null;
          table_name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bundle_items: {
        Row: {
          bundle_variant_id: string;
          component_variant_id: string;
          created_at: string;
          qty: number;
        };
        Insert: {
          bundle_variant_id: string;
          component_variant_id: string;
          created_at?: string;
          qty: number;
        };
        Update: {
          bundle_variant_id?: string;
          component_variant_id?: string;
          created_at?: string;
          qty?: number;
        };
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_variant_id_fkey";
            columns: ["bundle_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bundle_items_bundle_variant_id_fkey";
            columns: ["bundle_variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "bundle_items_component_variant_id_fkey";
            columns: ["component_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bundle_items_component_variant_id_fkey";
            columns: ["component_variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      cash_movements: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          note: string;
          shift_id: string;
          type: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string;
          shift_id: string;
          type: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string;
          shift_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_movements_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          parent_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string;
          created_at: string;
          deleted_at: string | null;
          email: string;
          id: string;
          name: string;
          phone: string;
          points: number;
          receivable_balance: number;
          updated_at: string;
        };
        Insert: {
          address?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name: string;
          phone?: string;
          points?: number;
          receivable_balance?: number;
          updated_at?: string;
        };
        Update: {
          address?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
          phone?: string;
          points?: number;
          receivable_balance?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string;
          created_at: string;
          created_by: string | null;
          expense_date: string;
          id: string;
          note: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          expense_date?: string;
          id?: string;
          note?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          expense_date?: string;
          id?: string;
          note?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      goods_receipt_items: {
        Row: {
          batch_no: string;
          cost_price: number;
          created_at: string;
          expiry_date: string | null;
          gr_id: string;
          id: string;
          qty: number;
          variant_id: string;
        };
        Insert: {
          batch_no?: string;
          cost_price: number;
          created_at?: string;
          expiry_date?: string | null;
          gr_id: string;
          id?: string;
          qty: number;
          variant_id: string;
        };
        Update: {
          batch_no?: string;
          cost_price?: number;
          created_at?: string;
          expiry_date?: string | null;
          gr_id?: string;
          id?: string;
          qty?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_gr_id_fkey";
            columns: ["gr_id"];
            isOneToOne: false;
            referencedRelation: "goods_receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      goods_receipts: {
        Row: {
          created_at: string;
          gr_no: string;
          id: string;
          note: string;
          po_id: string;
          received_at: string;
          received_by: string | null;
        };
        Insert: {
          created_at?: string;
          gr_no: string;
          id?: string;
          note?: string;
          po_id: string;
          received_at?: string;
          received_by?: string | null;
        };
        Update: {
          created_at?: string;
          gr_no?: string;
          id?: string;
          note?: string;
          po_id?: string;
          received_at?: string;
          received_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receipts_po_id_fkey";
            columns: ["po_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_transactions: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string;
          id: string;
          note: string | null;
          points: number;
          sale_id: string | null;
          type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          id?: string;
          note?: string | null;
          points: number;
          sale_id?: string | null;
          type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          id?: string;
          note?: string | null;
          points?: number;
          sale_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_transactions_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      number_sequences: {
        Row: {
          last_value: number;
          name: string;
          period: string | null;
          prefix: string;
          updated_at: string;
        };
        Insert: {
          last_value?: number;
          name: string;
          period?: string | null;
          prefix?: string;
          updated_at?: string;
        };
        Update: {
          last_value?: number;
          name?: string;
          period?: string | null;
          prefix?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_active: boolean;
          name: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string;
          id?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          id?: string;
        };
        Relationships: [];
      };
      price_tiers: {
        Row: {
          created_at: string;
          id: string;
          min_qty: number;
          price: number;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          min_qty: number;
          price: number;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          min_qty?: number;
          price?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_tiers_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_tiers_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      product_variants: {
        Row: {
          barcode: string | null;
          cost_price: number;
          created_at: string;
          deleted_at: string | null;
          id: string;
          image_url: string | null;
          min_stock: number;
          product_id: string;
          sell_price: number;
          sku: string;
          track_stock: boolean;
          updated_at: string;
          variant_name: string;
        };
        Insert: {
          barcode?: string | null;
          cost_price?: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          image_url?: string | null;
          min_stock?: number;
          product_id: string;
          sell_price?: number;
          sku: string;
          track_stock?: boolean;
          updated_at?: string;
          variant_name?: string;
        };
        Update: {
          barcode?: string | null;
          cost_price?: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          image_url?: string | null;
          min_stock?: number;
          product_id?: string;
          sell_price?: number;
          sku?: string;
          track_stock?: boolean;
          updated_at?: string;
          variant_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["product_id"];
          },
        ];
      };
      products: {
        Row: {
          brand_id: string | null;
          category_id: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          is_bundle: boolean;
          name: string;
          unit_id: string | null;
          updated_at: string;
        };
        Insert: {
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_bundle?: boolean;
          name: string;
          unit_id?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_bundle?: boolean;
          name?: string;
          unit_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          pin_attempts: number;
          pin_hash: string | null;
          pin_locked_until: string | null;
          role_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          pin_attempts?: number;
          pin_hash?: string | null;
          pin_locked_until?: string | null;
          role_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          pin_attempts?: number;
          pin_hash?: string | null;
          pin_locked_until?: string | null;
          role_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      promotions: {
        Row: {
          buy_qty: number;
          created_at: string;
          end_at: string;
          get_qty: number;
          id: string;
          is_active: boolean;
          min_purchase: number;
          name: string;
          scope: string;
          scope_ref_id: string | null;
          start_at: string;
          type: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          buy_qty?: number;
          created_at?: string;
          end_at?: string;
          get_qty?: number;
          id?: string;
          is_active?: boolean;
          min_purchase?: number;
          name: string;
          scope?: string;
          scope_ref_id?: string | null;
          start_at?: string;
          type: string;
          updated_at?: string;
          value?: number;
        };
        Update: {
          buy_qty?: number;
          created_at?: string;
          end_at?: string;
          get_qty?: number;
          id?: string;
          is_active?: boolean;
          min_purchase?: number;
          name?: string;
          scope?: string;
          scope_ref_id?: string | null;
          start_at?: string;
          type?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          cost_price: number;
          created_at: string;
          id: string;
          po_id: string;
          qty: number;
          received_qty: number;
          variant_id: string;
        };
        Insert: {
          cost_price: number;
          created_at?: string;
          id?: string;
          po_id: string;
          qty: number;
          received_qty?: number;
          variant_id: string;
        };
        Update: {
          cost_price?: number;
          created_at?: string;
          id?: string;
          po_id?: string;
          qty?: number;
          received_qty?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey";
            columns: ["po_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string;
          order_date: string;
          po_no: string;
          status: string;
          supplier_id: string;
          total: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string;
          order_date?: string;
          po_no: string;
          status?: string;
          supplier_id: string;
          total?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string;
          order_date?: string;
          po_no?: string;
          status?: string;
          supplier_id?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_return_items: {
        Row: {
          cost_price: number;
          created_at: string;
          id: string;
          qty: number;
          return_id: string;
          variant_id: string;
        };
        Insert: {
          cost_price: number;
          created_at?: string;
          id?: string;
          qty: number;
          return_id: string;
          variant_id: string;
        };
        Update: {
          cost_price?: number;
          created_at?: string;
          id?: string;
          qty?: number;
          return_id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "purchase_returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_return_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_return_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      purchase_returns: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          reason: string;
          return_no: string;
          supplier_id: string;
          total_refund: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason: string;
          return_no: string;
          supplier_id: string;
          total_refund?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason?: string;
          return_no?: string;
          supplier_id?: string;
          total_refund?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      receivable_payments: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          id: string;
          note: string;
          paid_at: string;
          payment_method_id: string | null;
          sale_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          id?: string;
          note?: string;
          paid_at?: string;
          payment_method_id?: string | null;
          sale_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          id?: string;
          note?: string;
          paid_at?: string;
          payment_method_id?: string | null;
          sale_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receivable_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receivable_payments_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receivable_payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          created_at?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          created_at?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          id: string;
          is_system: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_system?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sale_items: {
        Row: {
          cost_price: number;
          created_at: string;
          discount: number;
          id: string;
          is_gift: boolean;
          product_name: string;
          qty: number;
          sale_id: string;
          sku: string;
          subtotal: number;
          unit_price: number;
          variant_id: string | null;
        };
        Insert: {
          cost_price?: number;
          created_at?: string;
          discount?: number;
          id?: string;
          is_gift?: boolean;
          product_name: string;
          qty: number;
          sale_id: string;
          sku?: string;
          subtotal: number;
          unit_price: number;
          variant_id?: string | null;
        };
        Update: {
          cost_price?: number;
          created_at?: string;
          discount?: number;
          id?: string;
          is_gift?: boolean;
          product_name?: string;
          qty?: number;
          sale_id?: string;
          sku?: string;
          subtotal?: number;
          unit_price?: number;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      sale_payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          payment_method_id: string | null;
          reference_no: string | null;
          sale_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          payment_method_id?: string | null;
          reference_no?: string | null;
          sale_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          payment_method_id?: string | null;
          reference_no?: string | null;
          sale_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sale_payments_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_return_items: {
        Row: {
          created_at: string;
          id: string;
          qty: number;
          refund_amount: number;
          return_id: string;
          sale_item_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          qty: number;
          refund_amount: number;
          return_id: string;
          sale_item_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          qty?: number;
          refund_amount?: number;
          return_id?: string;
          sale_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sale_return_items_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "sale_returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_return_items_sale_item_id_fkey";
            columns: ["sale_item_id"];
            isOneToOne: false;
            referencedRelation: "sale_items";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_returns: {
        Row: {
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          reason: string;
          refund_method_id: string | null;
          sale_id: string;
          total_refund: number;
        };
        Insert: {
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason: string;
          refund_method_id?: string | null;
          sale_id: string;
          total_refund: number;
        };
        Update: {
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason?: string;
          refund_method_id?: string | null;
          sale_id?: string;
          total_refund?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_returns_refund_method_id_fkey";
            columns: ["refund_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_returns_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          change_amount: number;
          created_at: string;
          customer_id: string | null;
          discount_total: number;
          grand_total: number;
          id: string;
          idempotency_key: string;
          invoice_no: string;
          paid_total: number;
          promotion_id: string | null;
          rounding: number;
          service_fee: number;
          shift_id: string | null;
          status: string;
          subtotal: number;
          tax_total: number;
          updated_at: string;
          user_id: string;
          void_reason: string | null;
          voided_by: string | null;
          voucher_id: string | null;
        };
        Insert: {
          change_amount?: number;
          created_at?: string;
          customer_id?: string | null;
          discount_total?: number;
          grand_total?: number;
          id?: string;
          idempotency_key: string;
          invoice_no: string;
          paid_total?: number;
          promotion_id?: string | null;
          rounding?: number;
          service_fee?: number;
          shift_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_total?: number;
          updated_at?: string;
          user_id: string;
          void_reason?: string | null;
          voided_by?: string | null;
          voucher_id?: string | null;
        };
        Update: {
          change_amount?: number;
          created_at?: string;
          customer_id?: string | null;
          discount_total?: number;
          grand_total?: number;
          id?: string;
          idempotency_key?: string;
          invoice_no?: string;
          paid_total?: number;
          promotion_id?: string | null;
          rounding?: number;
          service_fee?: number;
          shift_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_total?: number;
          updated_at?: string;
          user_id?: string;
          void_reason?: string | null;
          voided_by?: string | null;
          voucher_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_promotion_id_fkey";
            columns: ["promotion_id"];
            isOneToOne: false;
            referencedRelation: "promotions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "vouchers";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          closed_at: string | null;
          closing_cash: number | null;
          created_at: string;
          difference: number | null;
          expected_cash: number | null;
          id: string;
          opened_at: string;
          opening_cash: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          closed_at?: string | null;
          closing_cash?: number | null;
          created_at?: string;
          difference?: number | null;
          expected_cash?: number | null;
          id?: string;
          opened_at?: string;
          opening_cash?: number;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          closed_at?: string | null;
          closing_cash?: number | null;
          created_at?: string;
          difference?: number | null;
          expected_cash?: number | null;
          id?: string;
          opened_at?: string;
          opening_cash?: number;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      stock_batches: {
        Row: {
          batch_no: string;
          created_at: string;
          expiry_date: string | null;
          id: string;
          qty: number;
          variant_id: string;
        };
        Insert: {
          batch_no?: string;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          qty?: number;
          variant_id: string;
        };
        Update: {
          batch_no?: string;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          qty?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_batches_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_batches_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          balance_after: number;
          batch_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          note: string;
          qty_change: number;
          ref_id: string | null;
          ref_type: string | null;
          type: string;
          variant_id: string;
        };
        Insert: {
          balance_after: number;
          batch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string;
          qty_change: number;
          ref_id?: string | null;
          ref_type?: string | null;
          type: string;
          variant_id: string;
        };
        Update: {
          balance_after?: number;
          batch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string;
          qty_change?: number;
          ref_id?: string | null;
          ref_type?: string | null;
          type?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "stock_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      stock_opname_items: {
        Row: {
          actual_qty: number;
          created_at: string;
          diff: number;
          id: string;
          opname_id: string;
          system_qty: number;
          variant_id: string;
        };
        Insert: {
          actual_qty?: number;
          created_at?: string;
          diff?: number;
          id?: string;
          opname_id: string;
          system_qty?: number;
          variant_id: string;
        };
        Update: {
          actual_qty?: number;
          created_at?: string;
          diff?: number;
          id?: string;
          opname_id?: string;
          system_qty?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_opname_items_opname_id_fkey";
            columns: ["opname_id"];
            isOneToOne: false;
            referencedRelation: "stock_opnames";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_opname_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_opname_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      stock_opnames: {
        Row: {
          approved_by: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          approved_by?: string | null;
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_by?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stocks: {
        Row: {
          qty: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          qty?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          qty?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stocks_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: true;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stocks_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: true;
            referencedRelation: "stock_overview";
            referencedColumns: ["variant_id"];
          },
        ];
      };
      supplier_payments: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          method: string;
          note: string;
          paid_at: string;
          po_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          method?: string;
          note?: string;
          paid_at?: string;
          po_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          method?: string;
          note?: string;
          paid_at?: string;
          po_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_payments_po_id_fkey";
            columns: ["po_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          payment_terms_days: number;
          phone: string;
          updated_at: string;
        };
        Insert: {
          address?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          payment_terms_days?: number;
          phone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          payment_terms_days?: number;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          short_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          short_name?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          short_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      voucher_usages: {
        Row: {
          created_at: string;
          discount_amount: number;
          id: string;
          sale_id: string;
          voucher_id: string;
        };
        Insert: {
          created_at?: string;
          discount_amount: number;
          id?: string;
          sale_id: string;
          voucher_id: string;
        };
        Update: {
          created_at?: string;
          discount_amount?: number;
          id?: string;
          sale_id?: string;
          voucher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voucher_usages_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: true;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voucher_usages_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "vouchers";
            referencedColumns: ["id"];
          },
        ];
      };
      vouchers: {
        Row: {
          code: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          min_purchase: number;
          quota: number;
          type: string;
          updated_at: string;
          used_count: number;
          value: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          min_purchase?: number;
          quota?: number;
          type: string;
          updated_at?: string;
          used_count?: number;
          value: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          min_purchase?: number;
          quota?: number;
          type?: string;
          updated_at?: string;
          used_count?: number;
          value?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      stock_overview: {
        Row: {
          barcode: string | null;
          category_id: string | null;
          category_name: string | null;
          min_stock: number | null;
          product_id: string | null;
          product_name: string | null;
          qty: number | null;
          sku: string | null;
          status: string | null;
          track_stock: boolean | null;
          variant_id: string | null;
          variant_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      adjust_loyalty_points: {
        Args: { p_customer_id: string; p_note: string; p_points: number };
        Returns: Json;
      };
      adjust_stock: {
        Args: { p_new_qty: number; p_reason: string; p_variant_id: string };
        Returns: Json;
      };
      approve_stock_opname: { Args: { p_opname_id: string }; Returns: Json };
      build_sale_receipt: { Args: { p_sale_id: string }; Returns: Json };
      cash_flow_report: {
        Args: { p_from: string; p_to: string };
        Returns: {
          entries: number;
          flow_direction: string;
          flow_label: string;
          flow_source: string;
          total: number;
        }[];
      };
      close_shift: {
        Args: { p_closing_cash: number; p_note?: string; p_shift_id: string };
        Returns: Json;
      };
      consume_stock: {
        Args: {
          p_movement_type: string;
          p_note: string;
          p_qty: number;
          p_ref_id: string;
          p_ref_type: string;
          p_user_id: string;
          p_variant_id: string;
        };
        Returns: undefined;
      };
      create_purchase_order: { Args: { p_payload: Json }; Returns: Json };
      create_purchase_return: { Args: { p_payload: Json }; Returns: Json };
      create_return: {
        Args: {
          p_items: Json;
          p_reason: string;
          p_refund_method_id: string;
          p_sale_id: string;
        };
        Returns: Json;
      };
      create_sale: { Args: { p_payload: Json }; Returns: Json };
      daily_sales_summary: {
        Args: { p_date: string };
        Returns: {
          discount_total: number;
          gross_sales: number;
          items_sold: number;
          net_sales: number;
          transactions: number;
        }[];
      };
      expense_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          category_id: string;
          category_name: string;
          entries: number;
          total: number;
        }[];
      };
      get_setting_number: {
        Args: { p_default: number; p_key: string };
        Returns: number;
      };
      has_permission: { Args: { p_code: string }; Returns: boolean };
      hold_sale: { Args: { p_payload: Json }; Returns: Json };
      monthly_sales_summary: {
        Args: { p_month: number; p_year: number };
        Returns: Database["public"]["CompositeTypes"]["sales_day_summary"][];
        SetofOptions: {
          from: "*";
          to: "sales_day_summary";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      next_number: { Args: { p_name: string }; Returns: number };
      open_shift: { Args: { p_opening_cash: number }; Returns: Json };
      profit_by_period: {
        Args: { p_from: string; p_granularity?: string; p_to: string };
        Returns: {
          cogs: number;
          expense_total: number;
          net_profit: number;
          net_sales: number;
          period_start: string;
        }[];
      };
      profit_by_product: {
        Args: {
          p_category_id?: string;
          p_from: string;
          p_sort?: string;
          p_to: string;
        };
        Returns: {
          cogs: number;
          margin_percent: number;
          product_id: string;
          product_name: string;
          profit: number;
          qty_sold: number;
          revenue: number;
        }[];
      };
      profit_loss_monthly: {
        Args: { p_from: string; p_to: string };
        Returns: {
          cogs: number;
          expense_total: number;
          month_start: string;
          net_profit: number;
          net_sales: number;
        }[];
      };
      profit_loss_report: {
        Args: { p_from: string; p_to: string };
        Returns: {
          cogs: number;
          discount_total: number;
          expense_total: number;
          gross_profit: number;
          gross_sales: number;
          net_profit: number;
          net_sales: number;
        }[];
      };
      receive_goods: { Args: { p_payload: Json }; Returns: Json };
      record_receivable_payment: { Args: { p_payload: Json }; Returns: Json };
      restore_sale_stock: {
        Args: {
          p_movement_type: string;
          p_note: string;
          p_qty: number;
          p_ref_id: string;
          p_ref_type: string;
          p_sale_id: string;
          p_user_id: string;
          p_variant_id: string;
        };
        Returns: undefined;
      };
      resume_sale: {
        Args: { p_discard?: boolean; p_sale_id: string };
        Returns: Json;
      };
      sales_by_cashier: {
        Args: { p_from: string; p_to: string };
        Returns: {
          avg_per_transaction: number;
          cashier_name: string;
          revenue: number;
          transactions: number;
          user_id: string;
        }[];
      };
      sales_by_category: {
        Args: { p_from: string; p_to: string };
        Returns: {
          category_id: string;
          category_name: string;
          qty_sold: number;
          revenue: number;
        }[];
      };
      sales_by_date_range: {
        Args: { p_from: string; p_to: string };
        Returns: Database["public"]["CompositeTypes"]["sales_day_summary"][];
        SetofOptions: {
          from: "*";
          to: "sales_day_summary";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      sales_by_payment_method: {
        Args: { p_from: string; p_to: string };
        Returns: {
          method_name: string;
          method_type: string;
          total: number;
          transactions: number;
        }[];
      };
      sales_by_product: {
        Args: { p_category_id?: string; p_from: string; p_to: string };
        Returns: {
          avg_price: number;
          product_id: string;
          product_name: string;
          qty_sold: number;
          revenue: number;
          sku: string;
          variant_id: string;
          variant_name: string;
        }[];
      };
      shift_summary: { Args: { p_shift_id: string }; Returns: Json };
      stock_valuation: {
        Args: Record<PropertyKey, never>;
        Returns: {
          cost_price: number;
          product_name: string;
          qty: number;
          sku: string;
          stock_value: number;
          variant_id: string;
          variant_name: string;
        }[];
      };
      top_products: {
        Args: { p_from: string; p_limit?: number; p_to: string };
        Returns: {
          product_id: string;
          product_name: string;
          qty_sold: number;
          revenue: number;
        }[];
      };
      void_sale: {
        Args: { p_reason: string; p_sale_id: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      sales_day_summary: {
        day: string | null;
        transactions: number | null;
        gross_sales: number | null;
        discount_total: number | null;
        net_sales: number | null;
        items_sold: number | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
