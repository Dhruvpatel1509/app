-- ============================================================
-- Cashual — Receipts storage bucket + EUR defaults
-- Run this in the Supabase SQL Editor.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "receipts_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "receipts_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "receipts_storage_delete_own" ON storage.objects;

CREATE POLICY "receipts_storage_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "receipts_storage_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "receipts_storage_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "receipts_storage_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

UPDATE public.profiles SET preferred_currency = 'EUR' WHERE preferred_currency IS DISTINCT FROM 'EUR';
UPDATE public.groups SET currency_code = 'EUR' WHERE currency_code IS DISTINCT FROM 'EUR';
UPDATE public.expenses SET currency_code = 'EUR' WHERE currency_code IS DISTINCT FROM 'EUR';
UPDATE public.receipts SET currency_code = 'EUR' WHERE currency_code IS DISTINCT FROM 'EUR';
UPDATE public.settlements SET currency_code = 'EUR' WHERE currency_code IS DISTINCT FROM 'EUR';
UPDATE public.budgets SET currency_code = 'EUR' WHERE currency_code IS DISTINCT FROM 'EUR';
