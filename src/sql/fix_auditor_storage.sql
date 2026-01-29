-- ============================================================
-- FIX AUDITOR STORAGE SCRIPT
-- Run this entire script to ensure the auditor storage bucket exists
-- and has the correct permissions.
-- ============================================================

-- 1. Create the 'tabulation-auditor' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tabulation-auditor',
  'tabulation-auditor',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Drop existing policies to avoid conflicts/duplicates
DROP POLICY IF EXISTS "auditor_public_read" ON storage.objects;
DROP POLICY IF EXISTS "auditor_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "auditor_public_update" ON storage.objects;
DROP POLICY IF EXISTS "auditor_public_delete" ON storage.objects;

-- 3. Re-create policies to ensure full public access
-- Read
CREATE POLICY "auditor_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tabulation-auditor');

-- Insert
CREATE POLICY "auditor_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tabulation-auditor');

-- Update
CREATE POLICY "auditor_public_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tabulation-auditor');

-- Delete
CREATE POLICY "auditor_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tabulation-auditor');

-- 4. Verify completion
DO $$
BEGIN
  RAISE NOTICE 'Auditor storage bucket and policies have been successfully configured.';
END $$;
