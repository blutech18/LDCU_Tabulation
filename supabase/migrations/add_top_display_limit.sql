-- Add top_display_limit column to events table
-- This column controls how many top results are displayed in the auditor's Final Results view
-- NULL or 0 = Show All, 3-10 = Show only top N results

ALTER TABLE events
ADD COLUMN IF NOT EXISTS top_display_limit INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.top_display_limit IS 'Controls how many top rankings to display in auditor results. NULL or 0 = show all, 3-10 = show only top N';
