-- Sub-PRD 0.3: tabel katalog & stok (PRD 6.2).
-- stock_movements adalah sumber kebenaran; stocks hanyalah saldo cache.

-- ============ CATEGORIES (bertingkat via parent_id) ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.categories (id) ON DELETE RESTRICT,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (id <> parent_id)
);
CREATE INDEX idx_categories_parent_id ON public.categories (parent_id);
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ BRANDS ============
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ UNITS ============
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories (id) ON DELETE RESTRICT,
  brand_id uuid REFERENCES public.brands (id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES public.units (id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  is_bundle boolean NOT NULL DEFAULT FALSE,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_products_category_id ON public.products (category_id);
CREATE INDEX idx_products_brand_id ON public.products (brand_id);
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ PRODUCT_VARIANTS ============
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  barcode text UNIQUE,
  variant_name text NOT NULL DEFAULT '',
  cost_price numeric(15, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price numeric(15, 2) NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  min_stock numeric(15, 3) NOT NULL DEFAULT 0,
  track_stock boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_product_variants_product_id ON public.product_variants (product_id);
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ PRICE_TIERS (harga grosir bertingkat, fase 2) ============
CREATE TABLE public.price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE CASCADE,
  min_qty numeric(15, 3) NOT NULL CHECK (min_qty > 0),
  price numeric(15, 2) NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, min_qty)
);
CREATE INDEX idx_price_tiers_variant_id ON public.price_tiers (variant_id);

-- ============ BUNDLE_ITEMS (fase 4) ============
CREATE TABLE public.bundle_items (
  bundle_variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE CASCADE,
  component_variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE RESTRICT,
  qty numeric(15, 3) NOT NULL CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bundle_variant_id, component_variant_id),
  CHECK (bundle_variant_id <> component_variant_id)
);

-- ============ STOCKS (saldo cache per varian) ============
CREATE TABLE public.stocks (
  variant_id uuid PRIMARY KEY REFERENCES public.product_variants (id) ON DELETE CASCADE,
  qty numeric(15, 3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_stocks_updated_at
  BEFORE UPDATE ON public.stocks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ STOCK_BATCHES (fase 4: batch & expired) ============
CREATE TABLE public.stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE CASCADE,
  batch_no text NOT NULL DEFAULT '',
  qty numeric(15, 3) NOT NULL DEFAULT 0,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_batches_variant_id ON public.stock_batches (variant_id);
CREATE INDEX idx_stock_batches_expiry_date ON public.stock_batches (expiry_date);

-- ============ STOCK_MOVEMENTS (buku besar, immutable) ============
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES public.stock_batches (id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('sale', 'purchase', 'adjust', 'return_in', 'return_out', 'opname', 'void')),
  qty_change numeric(15, 3) NOT NULL CHECK (qty_change <> 0),
  balance_after numeric(15, 3) NOT NULL,
  ref_type text,
  ref_id uuid,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_variant_created
  ON public.stock_movements (variant_id, created_at DESC);
CREATE INDEX idx_stock_movements_ref ON public.stock_movements (ref_type, ref_id);

-- ============ STOCK_OPNAMES (fase 2) ============
CREATE TABLE public.stock_opnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved')),
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_stock_opnames_updated_at
  BEFORE UPDATE ON public.stock_opnames
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id uuid NOT NULL REFERENCES public.stock_opnames (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE RESTRICT,
  system_qty numeric(15, 3) NOT NULL DEFAULT 0,
  actual_qty numeric(15, 3) NOT NULL DEFAULT 0,
  diff numeric(15, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opname_id, variant_id)
);
CREATE INDEX idx_stock_opname_items_opname_id
  ON public.stock_opname_items (opname_id);
