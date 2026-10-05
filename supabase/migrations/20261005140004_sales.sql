-- Sub-PRD 0.3: tabel penjualan (PRD 6.3, subset fase 1).
-- receivable_payments menyusul di fase 3 (hutang & piutang).

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  receivable_balance numeric(15, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ SHIFTS ============
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric(15, 2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  expected_cash numeric(15, 2),
  closing_cash numeric(15, 2),
  difference numeric(15, 2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shifts_user_id ON public.shifts (user_id);
CREATE INDEX idx_shifts_status ON public.shifts (status);
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ CASH_MOVEMENTS ============
CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in', 'out')),
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_movements_shift_id ON public.cash_movements (shift_id);

-- ============ SALES ============
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  shift_id uuid REFERENCES public.shifts (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  customer_id uuid REFERENCES public.customers (id) ON DELETE RESTRICT,
  subtotal numeric(15, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total numeric(15, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total numeric(15, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  service_fee numeric(15, 2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  rounding numeric(15, 2) NOT NULL DEFAULT 0,
  grand_total numeric(15, 2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  paid_total numeric(15, 2) NOT NULL DEFAULT 0 CHECK (paid_total >= 0),
  change_amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('held', 'completed', 'void', 'partial_return', 'returned', 'credit')),
  voided_by uuid,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_created_at ON public.sales (created_at DESC);
CREATE INDEX idx_sales_user_id ON public.sales (user_id);
CREATE INDEX idx_sales_customer_id ON public.sales (customer_id);
CREATE INDEX idx_sales_shift_id ON public.sales (shift_id);
CREATE INDEX idx_sales_status ON public.sales (status);
CREATE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ SALE_ITEMS (dengan snapshot nama/SKU/harga) ============
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  sku text NOT NULL DEFAULT '',
  qty numeric(15, 3) NOT NULL CHECK (qty > 0),
  unit_price numeric(15, 2) NOT NULL CHECK (unit_price >= 0),
  cost_price numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  discount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  subtotal numeric(15, 2) NOT NULL CHECK (subtotal >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX idx_sale_items_variant_id ON public.sale_items (variant_id);

-- ============ SALE_PAYMENTS ============
CREATE TABLE public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES public.payment_methods (id) ON DELETE RESTRICT,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  reference_no text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_payments_sale_id ON public.sale_payments (sale_id);

-- ============ SALE_RETURNS (fase 2: void & retur) ============
CREATE TABLE public.sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE RESTRICT,
  reason text NOT NULL,
  total_refund numeric(15, 2) NOT NULL CHECK (total_refund >= 0),
  refund_method_id uuid REFERENCES public.payment_methods (id) ON DELETE RESTRICT,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_returns_sale_id ON public.sale_returns (sale_id);

CREATE TABLE public.sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sale_returns (id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items (id) ON DELETE RESTRICT,
  qty numeric(15, 3) NOT NULL CHECK (qty > 0),
  refund_amount numeric(15, 2) NOT NULL CHECK (refund_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_return_items_return_id
  ON public.sale_return_items (return_id);
