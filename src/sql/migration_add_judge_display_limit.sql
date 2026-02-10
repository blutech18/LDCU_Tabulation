-- Migration: Add judge_display_limit column to events table
-- When set, only the top N participants (by final rank) are shown to judges

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS judge_display_limit INTEGER DEFAULT NULL;

COMMENT ON COLUMN events.judge_display_limit IS 'When set, only show the top N participants (by final rank) to judges in their scoring panel';
