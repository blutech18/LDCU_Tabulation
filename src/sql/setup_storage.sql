-- ============================================================
-- LDCU TABULATION SYSTEM - STORAGE BUCKET SETUP
-- Creates storage buckets and policies for file uploads
-- ============================================================

-- ============================================================
-- DROP EXISTING POLICIES AND BUCKETS (Clean Install)
-- ============================================================

-- Drop policies for participant bucket
DROP POLICY IF EXISTS "participant_public_read" ON storage.objects;
DROP POLICY IF EXISTS "participant_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "participant_public_update" ON storage.objects;
DROP POLICY IF EXISTS "participant_public_delete" ON storage.objects;

-- Drop policies for category bucket
DROP POLICY IF EXISTS "category_public_read" ON storage.objects;
DROP POLICY IF EXISTS "category_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "category_public_update" ON storage.objects;
DROP POLICY IF EXISTS "category_public_delete" ON storage.objects;

-- Delete all objects in buckets before dropping
DELETE FROM storage.objects WHERE bucket_id = 'tabulation-participant';
DELETE FROM storage.objects WHERE bucket_id = 'tabulation-category';

-- Drop buckets
DELETE FROM storage.buckets WHERE id = 'tabulation-participant';
DELETE FROM storage.buckets WHERE id = 'tabulation-category';

-- ============================================================
-- 1. CREATE STORAGE BUCKETS
-- ============================================================

-- Bucket for participant photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tabulation-participant',
  'tabulation-participant',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket for category photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tabulation-category',
  'tabulation-category',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. STORAGE POLICIES - PARTICIPANT BUCKET
-- ============================================================

-- Allow public read access to participant photos
CREATE POLICY "participant_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tabulation-participant');

-- Allow public insert for participant photos
CREATE POLICY "participant_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tabulation-participant');

-- Allow public update for participant photos
CREATE POLICY "participant_public_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tabulation-participant');

-- Allow public delete for participant photos
CREATE POLICY "participant_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tabulation-participant');

-- ============================================================
-- 3. STORAGE POLICIES - CATEGORY BUCKET
-- ============================================================

-- Allow public read access to category photos
CREATE POLICY "category_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tabulation-category');

-- Allow public insert for category photos
CREATE POLICY "category_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tabulation-category');

-- Allow public update for category photos
CREATE POLICY "category_public_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tabulation-category');

-- Allow public delete for category photos
CREATE POLICY "category_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tabulation-category');

-- ============================================================
-- 4. STORAGE POLICIES - AUDITOR BUCKET
-- ============================================================

-- Allow public read access to auditor photos
CREATE POLICY "auditor_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tabulation-auditor');

-- Allow public insert for auditor photos
CREATE POLICY "auditor_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tabulation-auditor');

-- Allow public update for auditor photos
CREATE POLICY "auditor_public_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tabulation-auditor');

-- Allow public delete for auditor photos
CREATE POLICY "auditor_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tabulation-auditor');

-- ============================================================
-- NOTE: Policies are set to PUBLIC access (no authentication required)
-- This allows the application to upload/manage files without auth
-- If you need to restrict access, modify the policies above
-- ============================================================
