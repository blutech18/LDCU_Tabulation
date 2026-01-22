-- ============================================================
-- MIGRATION: Ensure judges table has photo_url column
-- ============================================================

-- Add photo_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'judges' 
        AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE judges ADD COLUMN photo_url TEXT;
    END IF;
END $$;
