-- ============================================================
-- ADD PARTICIPANT TYPE AND GENDER FIELDS
-- ============================================================
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Paste and click "Run"
-- 
-- This adds:
-- - participant_type to events table (individual, pair, group, team)
-- - gender to contestants table
-- ============================================================

-- Add participant_type to events table
-- individual = single person (e.g., Mr. LDCU, Ms. LDCU)
-- group = multiple people (e.g., dance troupe, team)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'participant_type'
    ) THEN
        ALTER TABLE events ADD COLUMN participant_type TEXT DEFAULT 'individual';
        ALTER TABLE events ADD CONSTRAINT events_participant_type_check 
            CHECK (participant_type IN ('individual', 'group'));
    END IF;
END $$;

-- Add gender to contestants table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contestants' AND column_name = 'gender'
    ) THEN
        ALTER TABLE contestants ADD COLUMN gender TEXT;
        ALTER TABLE contestants ADD CONSTRAINT contestants_gender_check 
            CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));
    END IF;
END $$;

-- Add index for participant_type
CREATE INDEX IF NOT EXISTS idx_events_participant_type ON events(participant_type);

-- Add index for gender
CREATE INDEX IF NOT EXISTS idx_contestants_gender ON contestants(gender);
