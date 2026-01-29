-- ============================================================
-- MIGRATION: Update Events Table and Setup Storage
-- 1. Remove description column from events
-- 2. Add photo_url column to events
-- 3. Create tabulation-event storage bucket
-- ============================================================

-- 1. Update events table structure
ALTER TABLE events DROP COLUMN IF EXISTS description;
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create the 'tabulation-event' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tabulation-event',
  'tabulation-event',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "event_public_read" ON storage.objects;
DROP POLICY IF EXISTS "event_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "event_public_update" ON storage.objects;
DROP POLICY IF EXISTS "event_public_delete" ON storage.objects;

-- 4. Create policies for full public access (since this is an admin tool)
-- Read
CREATE POLICY "event_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tabulation-event');

-- Insert
CREATE POLICY "event_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tabulation-event');

-- Update
CREATE POLICY "event_public_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tabulation-event');

-- Delete
CREATE POLICY "event_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tabulation-event');

DO $$
BEGIN
  RAISE NOTICE 'Events table updated and storage configured successfully.';
END $$;
