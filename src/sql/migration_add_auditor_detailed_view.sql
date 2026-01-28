-- Migration: Add auditor_detailed_view column to events table
-- This allows admins to control whether auditors can see detailed score breakdowns

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS auditor_detailed_view BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN events.auditor_detailed_view IS 'When true, auditors can view detailed score breakdowns by judge and criteria';
