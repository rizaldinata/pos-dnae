-- Sub-PRD 0.3: helpers dasar (extensions + functions).
-- Urutan: dijalankan pertama, sebelum semua tabel.

-- Trigram untuk pencarian fuzzy nama produk (PRD 6.6).
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

-- Dipakai trigger di semua tabel yang punya kolom updated_at.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Nomor urut atomik untuk invoice, PO, GR, retur, opname (PRD 6.6).
-- Mengembalikan nilai berikutnya (formatting prefix dilakukan di aplikasi).
-- Catatan: tabel public.number_sequences dibuat di migrasi access_system.
CREATE OR REPLACE FUNCTION public.next_number(p_name text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.number_sequences AS ns (name, last_value)
  VALUES (p_name, 1)
  ON CONFLICT (name) DO UPDATE
    SET last_value = ns.last_value + 1,
        updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_number(text) TO authenticated;
