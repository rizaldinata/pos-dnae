-- Sub-PRD 4.1: Bundle, batch & expired (PRD-05, INV-06).
--
-- Bagian sales:
--   * consume_stock      : kurangi stok dengan strategi FEFO (batch expired
--                           paling dekat dulu), stock_movements terkait batch_id.
--   * restore_sale_stock : kembalikan stok milik suatu transaksi (void/retur),
--                           termasuk pemulihan qty batch milik transaksi itu.
--   * create_sale        : bundle diperluas ke komponen — validasi & pengurangan
--                           stok menyasar komponen, bukan stok bundle.
--   * void_sale          : stok kembali per komponen, qty yang sudah diretur
--                           dikurangkan, batch dipulihkan.
--   * create_return      : stok kembali per komponen + pemulihan batch.
--   * stock_overview     : qty bundle = stok efektif dari komponen.
--
-- Error baru (prefix kode):
--   BUNDLE_EMPTY:SKU | NESTED_BUNDLE:SKU

-- ============ Helper: konsumsi stok (FEFO) ============
-- Tidak di-grant ke klien; hanya dipanggil fungsi SECURITY DEFINER lain
-- (create_sale) yang berjalan sebagai owner.
CREATE OR REPLACE FUNCTION public.consume_stock(
  p_variant_id uuid,
  p_qty numeric,
  p_movement_type text,
  p_ref_type text,
  p_ref_id uuid,
  p_note text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty numeric(15,3) := GREATEST(COALESCE(p_qty, 0), 0);
  v_balance numeric(15,3);
  v_running numeric(15,3);
  v_remaining numeric(15,3);
  v_take numeric(15,3);
  v_batch record;
BEGIN
  IF v_qty <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.stocks SET qty = qty - v_qty, updated_at = now()
  WHERE variant_id = p_variant_id
  RETURNING qty INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', p_variant_id;
  END IF;

  v_remaining := v_qty;
  v_running := v_balance + v_qty; -- saldo sebelum pengurangan batch

  -- FEFO: batch expired paling dekat dulu; batch tanpa tanggal kedaluwarsa
  -- dianggap tahan lama sehingga paling akhir. Urutan kunci konsisten dengan
  -- restore_sale_stock (anti-deadlock).
  FOR v_batch IN
    SELECT id, qty FROM public.stock_batches
    WHERE variant_id = p_variant_id AND qty > 0
    ORDER BY expiry_date ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_batch.qty, v_remaining);

    UPDATE public.stock_batches SET qty = qty - v_take WHERE id = v_batch.id;

    v_running := v_running - v_take;
    INSERT INTO public.stock_movements (
      variant_id, batch_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      p_variant_id, v_batch.id, p_movement_type, -v_take, v_running,
      p_ref_type, p_ref_id, p_note, p_user_id
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  -- Sisa qty yang tidak tercakup batch (batch habis / varian tanpa batch)
  -- dicatat sebagai satu movement tanpa batch_id.
  IF v_remaining > 0 THEN
    v_running := v_running - v_remaining;
    INSERT INTO public.stock_movements (
      variant_id, batch_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      p_variant_id, NULL, p_movement_type, -v_remaining, v_running,
      p_ref_type, p_ref_id, p_note, p_user_id
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_stock(uuid, numeric, text, text, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- ============ Helper: kembalikan stok milik transaksi ============
-- Dipakai void_sale & create_return. Batch dipulihkan ke batch milik
-- transaksi ini sebesar sisa konsumsi per batch (qty keluar − yang sudah
-- dipulihkan), urutan FEFO; sisanya dicatat tanpa batch.
CREATE OR REPLACE FUNCTION public.restore_sale_stock(
  p_sale_id uuid,
  p_variant_id uuid,
  p_qty numeric,
  p_movement_type text,
  p_ref_type text,
  p_ref_id uuid,
  p_note text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty numeric(15,3) := GREATEST(COALESCE(p_qty, 0), 0);
  v_balance numeric(15,3);
  v_running numeric(15,3);
  v_remaining numeric(15,3);
  v_take numeric(15,3);
  v_batch record;
BEGIN
  IF v_qty <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.stocks SET qty = qty + v_qty, updated_at = now()
  WHERE variant_id = p_variant_id
  RETURNING qty INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', p_variant_id;
  END IF;

  v_remaining := v_qty;
  v_running := v_balance - v_qty; -- saldo sebelum pemulihan batch

  FOR v_batch IN
    SELECT sm.batch_id,
           (-SUM(sm.qty_change) FILTER (WHERE sm.qty_change < 0))
           - COALESCE(SUM(sm.qty_change) FILTER (WHERE sm.qty_change > 0), 0)
             AS outstanding
    FROM public.stock_movements sm
    JOIN public.stock_batches sb ON sb.id = sm.batch_id
    WHERE sm.ref_type = 'sale'
      AND sm.ref_id = p_sale_id
      AND sm.variant_id = p_variant_id
      AND sm.batch_id IS NOT NULL
    GROUP BY sm.batch_id, sb.expiry_date, sb.created_at
    HAVING (-SUM(sm.qty_change) FILTER (WHERE sm.qty_change < 0))
           - COALESCE(SUM(sm.qty_change) FILTER (WHERE sm.qty_change > 0), 0) > 0
    ORDER BY sb.expiry_date ASC NULLS LAST, sb.created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_batch.outstanding, v_remaining);

    UPDATE public.stock_batches SET qty = qty + v_take WHERE id = v_batch.batch_id;

    v_running := v_running + v_take;
    INSERT INTO public.stock_movements (
      variant_id, batch_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      p_variant_id, v_batch.batch_id, p_movement_type, v_take, v_running,
      p_ref_type, p_ref_id, p_note, p_user_id
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    v_running := v_running + v_remaining;
    INSERT INTO public.stock_movements (
      variant_id, batch_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      p_variant_id, NULL, p_movement_type, v_remaining, v_running,
      p_ref_type, p_ref_id, p_note, p_user_id
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_sale_stock(uuid, uuid, numeric, text, text, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- ============ create_sale (bundle-aware + FEFO) ============
-- Versi 3.4 (loyalty) dengan dua perubahan:
--   1) Validasi stok memakai permintaan agregat: bundle diperluas ke komponen,
--      baris stocks dikunci berurutan (anti-deadlock), stok komponen dicek
--      terhadap total permintaan seluruh baris.
--   2) Pengurangan stok menyasar komponen bundle dan melewati consume_stock
--      (FEFO + link batch_id). Stok bundle sendiri tidak pernah berubah.
CREATE OR REPLACE FUNCTION public.create_sale(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key text := NULLIF(p_payload->>'idempotency_key', '');
  v_user_id uuid := NULLIF(p_payload->>'user_id', '')::uuid;
  v_shift_id uuid := NULLIF(p_payload->>'shift_id', '')::uuid;
  v_customer_id uuid := NULLIF(p_payload->>'customer_id', '')::uuid;
  v_allow_negative boolean := COALESCE((p_payload->>'allow_negative_stock')::boolean, FALSE);
  v_is_credit boolean := COALESCE((p_payload->>'is_credit')::boolean, FALSE);
  v_promotion_id uuid := NULLIF(p_payload->>'promotion_id', '')::uuid;
  v_voucher_code text := NULLIF(btrim(COALESCE(p_payload->>'voucher_code', '')), '');
  v_redeem_points integer := GREATEST(
    floor(COALESCE((p_payload->>'redeem_points')::numeric, 0))::integer, 0);
  v_tax_total numeric(15,2) := COALESCE((p_payload->>'tax_total')::numeric, 0);
  v_service_fee numeric(15,2) := COALESCE((p_payload->>'service_fee')::numeric, 0);
  v_rounding numeric(15,2) := COALESCE((p_payload->>'rounding')::numeric, 0);
  v_trx_discount numeric(15,2) := COALESCE((p_payload->>'transaction_discount')::numeric, 0);
  v_status text;
  v_existing_id uuid;
  v_sale_id uuid;
  v_invoice_no text;
  v_subtotal numeric(15,2) := 0;
  v_discount_total numeric(15,2) := 0;
  v_voucher_discount numeric(15,2) := 0;
  v_voucher_id uuid;
  v_redeem_discount numeric(15,2) := 0;
  v_point_value numeric(15,2);
  v_earn_ratio numeric(15,2);
  v_points_earned integer := 0;
  v_customer_points integer;
  v_grand_total numeric(15,2);
  v_paid_total numeric(15,2) := 0;
  v_change numeric(15,2);
  v_receivable numeric(15,2) := 0;
  v_item jsonb;
  v_payment jsonb;
  v_variant_id uuid;
  v_qty numeric(15,3);
  v_discount numeric(15,2);
  v_is_gift boolean;
  v_is_bundle boolean;
  v_sell_price numeric(15,2);
  v_effective_price numeric(15,2);
  v_cost_price numeric(15,2);
  v_product_name text;
  v_sku text;
  v_line_total numeric(15,2);
  v_payment_method_id uuid;
  v_amount numeric(15,2);
  v_reference_no text;
  v_method_active boolean;
  v_voucher record;
  v_voucher_base numeric(15,2);
  v_lock record;
  v_stock_rec record;
  v_component record;
BEGIN
  IF NOT public.has_permission('sale.create') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.create permission';
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'ITEMS_REQUIRED';
  END IF;

  IF v_is_credit THEN
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'CREDIT_CUSTOMER_REQUIRED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND:%', v_customer_id;
    END IF;
  ELSE
    IF jsonb_typeof(p_payload->'payments') <> 'array' OR jsonb_array_length(p_payload->'payments') = 0 THEN
      RAISE EXCEPTION 'PAYMENTS_REQUIRED';
    END IF;
  END IF;

  IF v_trx_discount < 0 THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT:transaction';
  END IF;

  IF v_promotion_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.promotions
      WHERE id = v_promotion_id AND is_active
        AND now() BETWEEN start_at AND end_at
    ) THEN
      RAISE EXCEPTION 'INVALID_PROMOTION:%', v_promotion_id;
    END IF;
  END IF;

  SELECT id INTO v_existing_id FROM public.sales WHERE idempotency_key = v_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    RETURN public.build_sale_receipt(v_existing_id);
  END IF;

  -- Loop harga: snapshot harga, tier, gift, dan validasi bundle.
  -- Cek stok dipindah ke validasi agregat di bawah (bundle-aware).
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_payload->'items')
    ORDER BY (value->>'variant_id')
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);
    v_is_gift := COALESCE((v_item->>'is_gift')::boolean, FALSE);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QTY:%', v_variant_id;
    END IF;
    IF v_discount < 0 THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT:%', v_variant_id;
    END IF;

    SELECT pv.sell_price, pv.cost_price, p.name, pv.sku, p.is_bundle
      INTO v_sell_price, v_cost_price, v_product_name, v_sku, v_is_bundle
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', v_variant_id;
    END IF;

    IF v_is_bundle THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.bundle_items bi
        WHERE bi.bundle_variant_id = v_variant_id
      ) THEN
        RAISE EXCEPTION 'BUNDLE_EMPTY:%', v_sku;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.bundle_items bi
        JOIN public.product_variants cv ON cv.id = bi.component_variant_id
        JOIN public.products cp ON cp.id = cv.product_id
        WHERE bi.bundle_variant_id = v_variant_id AND cp.is_bundle
      ) THEN
        RAISE EXCEPTION 'NESTED_BUNDLE:%', v_sku;
      END IF;
    END IF;

    IF v_is_gift THEN
      v_effective_price := 0;
      IF v_discount <> 0 THEN
        RAISE EXCEPTION 'INVALID_DISCOUNT:%', v_variant_id;
      END IF;
    ELSE
      SELECT pt.price INTO v_effective_price
      FROM public.price_tiers pt
      WHERE pt.variant_id = v_variant_id AND pt.min_qty <= v_qty
      ORDER BY pt.min_qty DESC
      LIMIT 1;
      IF NOT FOUND OR v_effective_price IS NULL THEN
        v_effective_price := v_sell_price;
      END IF;
    END IF;

    v_line_total := v_qty * v_effective_price;
    IF v_discount > v_line_total THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT:%', v_variant_id;
    END IF;

    v_subtotal := v_subtotal + v_line_total;
    v_discount_total := v_discount_total + v_discount;
  END LOOP;

  -- Kunci baris stocks terkait (bundle variant + komponen) urut variant_id
  -- agar dua transaksi bersamaan tidak pernah saling menunggu kunci.
  FOR v_lock IN
    SELECT s.variant_id
    FROM public.stocks s
    WHERE s.variant_id IN (
      SELECT u.variant_id FROM (
        SELECT (value->>'variant_id')::uuid AS variant_id
        FROM jsonb_array_elements(p_payload->'items')
        UNION
        SELECT bi.component_variant_id
        FROM jsonb_array_elements(p_payload->'items') AS item
        JOIN public.product_variants pv ON pv.id = (item.value->>'variant_id')::uuid
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.bundle_items bi ON bi.bundle_variant_id = pv.id
        WHERE p.is_bundle
      ) u
    )
    ORDER BY s.variant_id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  -- Validasi stok agregat: permintaan per varian hasil ekspansi bundle
  -- dibandingkan dengan saldo stok terkunci di atas.
  FOR v_stock_rec IN
    WITH demand AS (
      SELECT bi.component_variant_id AS variant_id,
             SUM(bi.qty * line.qty) AS required_qty
      FROM (
        SELECT (value->>'variant_id')::uuid AS variant_id,
               (value->>'qty')::numeric AS qty
        FROM jsonb_array_elements(p_payload->'items')
      ) AS line
      JOIN public.product_variants pv ON pv.id = line.variant_id
      JOIN public.products p ON p.id = pv.product_id
      JOIN public.bundle_items bi ON bi.bundle_variant_id = line.variant_id
      WHERE p.is_bundle
      GROUP BY 1
      UNION ALL
      SELECT line.variant_id, SUM(line.qty)
      FROM (
        SELECT (value->>'variant_id')::uuid AS variant_id,
               (value->>'qty')::numeric AS qty
        FROM jsonb_array_elements(p_payload->'items')
      ) AS line
      JOIN public.product_variants pv ON pv.id = line.variant_id
      JOIN public.products p ON p.id = pv.product_id
      WHERE NOT p.is_bundle
      GROUP BY 1
    ),
    total_demand AS (
      SELECT variant_id, SUM(required_qty) AS required_qty
      FROM demand
      GROUP BY 1
    )
    SELECT td.variant_id,
           td.required_qty,
           s.qty AS stock_qty,
           COALESCE(pv.sku, td.variant_id::text) AS sku
    FROM total_demand td
    JOIN public.product_variants pv ON pv.id = td.variant_id
    LEFT JOIN public.stocks s ON s.variant_id = td.variant_id
    ORDER BY td.variant_id
  LOOP
    IF v_stock_rec.stock_qty IS NULL THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', v_stock_rec.variant_id;
    END IF;
    IF NOT v_allow_negative AND v_stock_rec.stock_qty < v_stock_rec.required_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_stock_rec.sku;
    END IF;
  END LOOP;

  IF v_trx_discount > v_subtotal - v_discount_total THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT:transaction';
  END IF;
  v_discount_total := v_discount_total + v_trx_discount;

  -- Voucher: validasi penuh + hitung dari dasar setelah diskon.
  IF v_voucher_code IS NOT NULL THEN
    SELECT * INTO v_voucher FROM public.vouchers
    WHERE code = v_voucher_code FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:not found';
    END IF;
    IF NOT v_voucher.is_active THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:inactive';
    END IF;
    IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:expired';
    END IF;
    IF v_voucher.used_count >= v_voucher.quota THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:quota';
    END IF;

    v_voucher_base := v_subtotal - v_discount_total;
    IF v_voucher_base < v_voucher.min_purchase THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:min purchase';
    END IF;

    IF v_voucher.type = 'percent' THEN
      v_voucher_discount := LEAST(round(v_voucher_base * v_voucher.value / 100, 2), v_voucher_base);
    ELSE
      v_voucher_discount := LEAST(v_voucher.value, v_voucher_base);
    END IF;

    v_discount_total := v_discount_total + v_voucher_discount;
    v_voucher_id := v_voucher.id;
  END IF;

  -- Penukaran poin (POS-14): wajib pelanggan, saldo cukup, nilai poin dari
  -- settings; diskon dihitung server dan tidak boleh melebihi sisa tagihan.
  IF v_redeem_points > 0 THEN
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'REDEEM_CUSTOMER_REQUIRED';
    END IF;

    SELECT points INTO v_customer_points
    FROM public.customers
    WHERE id = v_customer_id AND deleted_at IS NULL
    FOR UPDATE;

    IF v_customer_points IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND:%', v_customer_id;
    END IF;
    IF v_customer_points < v_redeem_points THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS:%', v_redeem_points;
    END IF;

    v_point_value := public.get_setting_number('loyalty.point_value', 100);
    v_redeem_discount := v_redeem_points * v_point_value;
    IF v_redeem_discount > v_subtotal - v_discount_total THEN
      RAISE EXCEPTION 'REDEEM_EXCEEDS_TOTAL';
    END IF;

    v_discount_total := v_discount_total + v_redeem_discount;
  END IF;

  v_grand_total := v_subtotal - v_discount_total + v_tax_total + v_service_fee + v_rounding;
  IF v_grand_total < 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL';
  END IF;

  IF jsonb_typeof(p_payload->'payments') = 'array' THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
      v_payment_method_id := (v_payment->>'payment_method_id')::uuid;
      v_amount := (v_payment->>'amount')::numeric;

      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT';
      END IF;

      SELECT is_active INTO v_method_active
      FROM public.payment_methods
      WHERE id = v_payment_method_id AND deleted_at IS NULL;

      IF NOT FOUND OR NOT v_method_active THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_METHOD:%', v_payment_method_id;
      END IF;

      v_paid_total := v_paid_total + v_amount;
    END LOOP;
  END IF;

  IF v_is_credit THEN
    v_status := 'credit';
    v_receivable := v_grand_total - v_paid_total;
    IF v_receivable < 0 THEN
      RAISE EXCEPTION 'OVERPAY:paid exceeds total';
    END IF;
    v_change := 0;
  ELSE
    IF v_paid_total < v_grand_total THEN
      RAISE EXCEPTION 'UNDERPAID:paid % < total %', v_paid_total, v_grand_total;
    END IF;
    v_status := 'completed';
    v_change := v_paid_total - v_grand_total;
  END IF;

  v_invoice_no := 'INV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
    || '-' || lpad(public.next_number('invoice')::text, 4, '0');

  INSERT INTO public.sales (
    invoice_no, idempotency_key, shift_id, user_id, customer_id,
    subtotal, discount_total, tax_total, service_fee, rounding,
    grand_total, paid_total, change_amount, status, promotion_id, voucher_id
  ) VALUES (
    v_invoice_no, v_idempotency_key, v_shift_id, v_user_id, v_customer_id,
    v_subtotal, v_discount_total, v_tax_total, v_service_fee, v_rounding,
    v_grand_total, v_paid_total, v_change, v_status, v_promotion_id, v_voucher_id
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_payload->'items')
    ORDER BY (value->>'variant_id')
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);
    v_is_gift := COALESCE((v_item->>'is_gift')::boolean, FALSE);

    SELECT pv.sell_price, pv.cost_price, p.name, pv.sku, p.is_bundle
      INTO v_sell_price, v_cost_price, v_product_name, v_sku, v_is_bundle
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id;

    IF v_is_gift THEN
      v_effective_price := 0;
    ELSE
      SELECT pt.price INTO v_effective_price
      FROM public.price_tiers pt
      WHERE pt.variant_id = v_variant_id AND pt.min_qty <= v_qty
      ORDER BY pt.min_qty DESC
      LIMIT 1;
      IF NOT FOUND OR v_effective_price IS NULL THEN
        v_effective_price := v_sell_price;
      END IF;
    END IF;

    v_line_total := v_qty * v_effective_price;

    INSERT INTO public.sale_items (
      sale_id, variant_id, product_name, sku, qty,
      unit_price, cost_price, discount, subtotal, is_gift
    ) VALUES (
      v_sale_id, v_variant_id, v_product_name, v_sku, v_qty,
      v_effective_price, v_cost_price, v_discount, v_line_total - v_discount, v_is_gift
    );

    -- Bundle: stok komponen yang berkurang (bukan stok bundle), satu
    -- consume_stock per komponen sehingga movement terkait batch_id (FEFO).
    IF v_is_bundle THEN
      FOR v_component IN
        SELECT bi.component_variant_id AS variant_id,
               bi.qty * v_qty AS need_qty
        FROM public.bundle_items bi
        WHERE bi.bundle_variant_id = v_variant_id
        ORDER BY bi.component_variant_id
      LOOP
        PERFORM public.consume_stock(
          v_component.variant_id, v_component.need_qty,
          'sale', 'sale', v_sale_id,
          'Penjualan ' || v_invoice_no, v_user_id
        );
      END LOOP;
    ELSE
      PERFORM public.consume_stock(
        v_variant_id, v_qty,
        'sale', 'sale', v_sale_id,
        'Penjualan ' || v_invoice_no, v_user_id
      );
    END IF;
  END LOOP;

  IF jsonb_typeof(p_payload->'payments') = 'array' THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
      v_payment_method_id := (v_payment->>'payment_method_id')::uuid;
      v_amount := (v_payment->>'amount')::numeric;
      v_reference_no := NULLIF(v_payment->>'reference_no', '');

      INSERT INTO public.sale_payments (sale_id, payment_method_id, amount, reference_no)
      VALUES (v_sale_id, v_payment_method_id, v_amount, v_reference_no);
    END LOOP;
  END IF;

  IF v_voucher_id IS NOT NULL THEN
    UPDATE public.vouchers SET used_count = used_count + 1, updated_at = now()
    WHERE id = v_voucher_id;

    INSERT INTO public.voucher_usages (voucher_id, sale_id, discount_amount)
    VALUES (v_voucher_id, v_sale_id, v_voucher_discount);
  END IF;

  IF v_is_credit AND v_receivable > 0 THEN
    UPDATE public.customers
    SET receivable_balance = receivable_balance + v_receivable, updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  -- Loyalitas (CUS-02, POS-14): penukaran & perolehan poin dalam transaksi yang sama.
  IF v_customer_id IS NOT NULL THEN
    v_earn_ratio := public.get_setting_number('loyalty.earn_ratio', 10000);
    IF v_earn_ratio > 0 THEN
      v_points_earned := floor(v_grand_total / v_earn_ratio)::integer;
    END IF;

    IF v_redeem_points > 0 THEN
      INSERT INTO public.loyalty_transactions (customer_id, sale_id, points, type, created_by)
      VALUES (v_customer_id, v_sale_id, -v_redeem_points, 'redeem', v_user_id);
    END IF;

    IF v_points_earned > 0 THEN
      INSERT INTO public.loyalty_transactions (customer_id, sale_id, points, type, created_by)
      VALUES (v_customer_id, v_sale_id, v_points_earned, 'earn', v_user_id);
    END IF;

    IF v_redeem_points > 0 OR v_points_earned > 0 THEN
      UPDATE public.customers
      SET points = points - v_redeem_points + v_points_earned, updated_at = now()
      WHERE id = v_customer_id;
    END IF;
  END IF;

  RETURN public.build_sale_receipt(v_sale_id);
END;
$$;

-- ============ void_sale (sadar bundle & batch) ============
-- Perubahan vs versi 2.2:
--   * bundle dikembalikan ke komponennya;
--   * qty yang sudah diretur dikurangkan (tidak ada stok ganda);
--   * pengembalian lewat restore_sale_stock sehingga batch milik transaksi
--     ini ikut dipulihkan dan movement terkait batch_id.
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_restock record;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.has_permission('sale.void') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.void permission';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'VOID_REASON_REQUIRED';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND:%', p_sale_id;
  END IF;

  IF v_sale.status = 'void' THEN
    RAISE EXCEPTION 'SALE_ALREADY_VOID:%', p_sale_id;
  END IF;

  IF v_sale.status NOT IN ('completed', 'partial_return') THEN
    RAISE EXCEPTION 'SALE_NOT_VOIDABLE:%', v_sale.status;
  END IF;

  -- Ekspansi bundle → komponen, agregat per varian, urut variant_id
  -- (anti-deadlock). Qty yang sudah diretur tidak ikut dikembalikan.
  FOR v_restock IN
    WITH line_restock AS (
      SELECT si.variant_id,
             si.qty - COALESCE((
               SELECT SUM(sri.qty)
               FROM public.sale_return_items sri
               WHERE sri.sale_item_id = si.id
             ), 0) AS restock_qty
      FROM public.sale_items si
      WHERE si.sale_id = p_sale_id AND si.variant_id IS NOT NULL
    ),
    expanded AS (
      SELECT bi.component_variant_id AS variant_id,
             lr.restock_qty * bi.qty AS qty
      FROM line_restock lr
      JOIN public.product_variants pv ON pv.id = lr.variant_id
      JOIN public.products p ON p.id = pv.product_id
      JOIN public.bundle_items bi ON bi.bundle_variant_id = lr.variant_id
      WHERE p.is_bundle AND lr.restock_qty > 0
      UNION ALL
      SELECT lr.variant_id, lr.restock_qty
      FROM line_restock lr
      JOIN public.product_variants pv ON pv.id = lr.variant_id
      JOIN public.products p ON p.id = pv.product_id
      WHERE NOT p.is_bundle AND lr.restock_qty > 0
    )
    SELECT variant_id, SUM(qty) AS qty
    FROM expanded
    GROUP BY variant_id
    ORDER BY variant_id
  LOOP
    PERFORM public.restore_sale_stock(
      p_sale_id, v_restock.variant_id, v_restock.qty,
      'void', 'sale', p_sale_id,
      'Void ' || v_sale.invoice_no || ': ' || v_reason,
      auth.uid()
    );
  END LOOP;

  UPDATE public.sales
  SET status = 'void',
      voided_by = auth.uid(),
      void_reason = v_reason,
      updated_at = now()
  WHERE id = p_sale_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'sale.void', 'sales', p_sale_id::text,
    jsonb_build_object('invoice_no', v_sale.invoice_no, 'reason', v_reason)
  );

  RETURN public.build_sale_receipt(p_sale_id);
END;
$$;

-- ============ create_return (sadar bundle & batch) ============
-- Perubahan vs versi 2.2: pengembalian stok keluar dari loop entri dan
-- memakai ekspansi bundle + restore_sale_stock (movement return_in kini
-- mereferensikan sale_id agar tautan "Transaksi" di kartu stok tampil dan
-- pemulihan batch dapat dihitung per transaksi).
CREATE OR REPLACE FUNCTION public.create_return(
  p_sale_id uuid,
  p_items jsonb,
  p_refund_method_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_return_id uuid;
  v_total_refund numeric(15,2) := 0;
  v_entry jsonb;
  v_sale_item_id uuid;
  v_qty numeric(15,3);
  v_si record;
  v_returned_so_far numeric(15,3);
  v_refund numeric(15,2);
  v_method_active boolean;
  v_all_returned boolean := TRUE;
  v_any_returned boolean := FALSE;
  v_item record;
  v_restock record;
BEGIN
  IF NOT public.has_permission('sale.return') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.return permission';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'RETURN_REASON_REQUIRED';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'RETURN_ITEMS_REQUIRED';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND:%', p_sale_id;
  END IF;

  IF v_sale.status NOT IN ('completed', 'partial_return') THEN
    RAISE EXCEPTION 'SALE_NOT_RETURNABLE:%', v_sale.status;
  END IF;

  SELECT is_active INTO v_method_active
  FROM public.payment_methods
  WHERE id = p_refund_method_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT v_method_active THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD:%', p_refund_method_id;
  END IF;

  INSERT INTO public.sale_returns (sale_id, reason, total_refund, refund_method_id, approved_by, created_by)
  VALUES (p_sale_id, v_reason, 0, p_refund_method_id, auth.uid(), auth.uid())
  RETURNING id INTO v_return_id;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_sale_item_id := (v_entry->>'sale_item_id')::uuid;
    v_qty := (v_entry->>'qty')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_RETURN_QTY:%', v_sale_item_id;
    END IF;

    SELECT si.* INTO v_si
    FROM public.sale_items si
    WHERE si.id = v_sale_item_id AND si.sale_id = p_sale_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SALE_ITEM_NOT_FOUND:%', v_sale_item_id;
    END IF;

    SELECT COALESCE(sum(sri.qty), 0) INTO v_returned_so_far
    FROM public.sale_return_items sri
    JOIN public.sale_returns sr ON sr.id = sri.return_id
    WHERE sri.sale_item_id = v_sale_item_id;

    IF v_returned_so_far + v_qty > v_si.qty THEN
      RAISE EXCEPTION 'RETURN_QTY_EXCEEDS_SOLD:%', v_sale_item_id;
    END IF;

    -- Refund proporsional terhadap subtotal item (termasuk diskon).
    v_refund := round((v_si.subtotal / v_si.qty) * v_qty, 2);

    INSERT INTO public.sale_return_items (return_id, sale_item_id, qty, refund_amount)
    VALUES (v_return_id, v_sale_item_id, v_qty, v_refund);

    v_total_refund := v_total_refund + v_refund;
    v_any_returned := TRUE;
  END LOOP;

  IF NOT v_any_returned THEN
    RAISE EXCEPTION 'RETURN_ITEMS_REQUIRED';
  END IF;

  -- Kembalikan stok: ekspansi bundle → komponen, urut variant_id
  -- (anti-deadlock); batch dipulihkan ke batch milik transaksi ini.
  FOR v_restock IN
    WITH entry AS (
      SELECT (value->>'sale_item_id')::uuid AS sale_item_id,
             (value->>'qty')::numeric AS qty
      FROM jsonb_array_elements(p_items)
    ),
    line AS (
      SELECT e.qty AS return_qty, si.variant_id
      FROM entry e
      JOIN public.sale_items si
        ON si.id = e.sale_item_id AND si.sale_id = p_sale_id
      WHERE si.variant_id IS NOT NULL
    ),
    expanded AS (
      SELECT bi.component_variant_id AS variant_id,
             l.return_qty * bi.qty AS qty
      FROM line l
      JOIN public.product_variants pv ON pv.id = l.variant_id
      JOIN public.products p ON p.id = pv.product_id
      JOIN public.bundle_items bi ON bi.bundle_variant_id = l.variant_id
      WHERE p.is_bundle
      UNION ALL
      SELECT l.variant_id, l.return_qty
      FROM line l
      JOIN public.product_variants pv ON pv.id = l.variant_id
      JOIN public.products p ON p.id = pv.product_id
      WHERE NOT p.is_bundle
    )
    SELECT variant_id, SUM(qty) AS qty
    FROM expanded
    GROUP BY variant_id
    ORDER BY variant_id
  LOOP
    PERFORM public.restore_sale_stock(
      p_sale_id, v_restock.variant_id, v_restock.qty,
      'return_in', 'sale', p_sale_id,
      'Retur ' || v_sale.invoice_no || ': ' || v_reason,
      auth.uid()
    );
  END LOOP;

  UPDATE public.sale_returns SET total_refund = v_total_refund WHERE id = v_return_id;

  -- Tentukan status: semua item full diretur -> returned, else partial_return.
  FOR v_item IN SELECT id, qty FROM public.sale_items WHERE sale_id = p_sale_id LOOP
    SELECT COALESCE(sum(sri.qty), 0) INTO v_returned_so_far
    FROM public.sale_return_items sri
    JOIN public.sale_returns sr ON sr.id = sri.return_id
    WHERE sri.sale_item_id = v_item.id;
    IF v_returned_so_far < v_item.qty THEN
      v_all_returned := FALSE;
    END IF;
  END LOOP;

  UPDATE public.sales
  SET status = CASE WHEN v_all_returned THEN 'returned' ELSE 'partial_return' END,
      updated_at = now()
  WHERE id = p_sale_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'sale.return', 'sale_returns', v_return_id::text,
    jsonb_build_object('sale_id', p_sale_id, 'invoice_no', v_sale.invoice_no,
                       'total_refund', v_total_refund, 'reason', v_reason)
  );

  RETURN jsonb_build_object(
    'return', to_jsonb((SELECT r FROM public.sale_returns r WHERE r.id = v_return_id)),
    'total_refund', v_total_refund,
    'receipt', public.build_sale_receipt(p_sale_id)
  );
END;
$$;

-- ============ stock_overview: qty bundle = stok efektif komponen ============
-- Stok bundle tidak pernah dicatat di tabel stocks; tampilan & hitungan
-- stok menipis memakai jumlah bundle yang bisa dirakit dari komponen
-- (min atas floor(stok komponen / qty per bundle)).
CREATE OR REPLACE VIEW public.stock_overview WITH (security_invoker = true) AS
SELECT
  variant_id,
  product_id,
  product_name,
  variant_name,
  sku,
  barcode,
  category_id,
  category_name,
  min_stock,
  track_stock,
  qty,
  CASE
    WHEN qty <= 0 THEN 'habis'
    WHEN qty <= min_stock THEN 'menipis'
    ELSE 'normal'
  END AS status
FROM (
  SELECT
    pv.id AS variant_id,
    p.id AS product_id,
    p.name AS product_name,
    pv.variant_name AS variant_name,
    pv.sku AS sku,
    pv.barcode AS barcode,
    p.category_id AS category_id,
    c.name AS category_name,
    pv.min_stock AS min_stock,
    pv.track_stock AS track_stock,
    CASE
      WHEN p.is_bundle THEN (
        SELECT COALESCE(MIN(FLOOR(COALESCE(cs.qty, 0) / bi.qty)), 0)
        FROM public.bundle_items bi
        LEFT JOIN public.stocks cs ON cs.variant_id = bi.component_variant_id
        WHERE bi.bundle_variant_id = pv.id
      )
      ELSE COALESCE(s.qty, 0)
    END AS qty
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id AND p.deleted_at IS NULL
  LEFT JOIN public.stocks s ON s.variant_id = pv.id
  LEFT JOIN public.categories c ON c.id = p.category_id
) t;

COMMENT ON VIEW public.stock_overview IS
  'Ringkasan stok per varian (normal/menipis/habis); qty bundle = stok efektif dari komponen. Sumber: Sub-PRD 1.2 + 4.1.';
