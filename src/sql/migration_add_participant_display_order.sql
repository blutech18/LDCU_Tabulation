-- ============================================================
-- MIGRATION: Add display_order to participants table
-- Purpose: Allow ordering of participants separately for male/female
-- ============================================================

-- Add display_order column to participants table
-- This allows separate ordering for male and female participants in individual events
ALTER TABLE participants ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index for better performance when ordering
CREATE INDEX IF NOT EXISTS idx_participants_display_order ON participants(event_id, gender, display_order);

-- Update existing participants to have display_order based on their number
UPDATE participants SET display_order = number WHERE display_order = 0 OR display_order IS NULL;
