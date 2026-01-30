-- ============================================================
-- MIGRATION: ADD JUDGE ACTIVITY LOGS
-- Tracks judge actions: submit, unlock, score changes
-- ============================================================

CREATE TABLE IF NOT EXISTS judge_activity_logs (
  id SERIAL PRIMARY KEY,
  judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'submit', 'unlock', 'score_change'
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Flexible field for extra details (participant_id, old_score, new_score, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE judge_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all reads (for admin panel)
CREATE POLICY "judge_activity_logs_read_all" ON judge_activity_logs 
  FOR SELECT 
  USING (true);

-- Policy: Allow inserts (for logging from client)
CREATE POLICY "judge_activity_logs_insert_all" ON judge_activity_logs 
  FOR INSERT 
  WITH CHECK (true);

-- Create indexes for faster querying
CREATE INDEX idx_judge_activity_logs_judge_id ON judge_activity_logs(judge_id);
CREATE INDEX idx_judge_activity_logs_category_id ON judge_activity_logs(category_id);
CREATE INDEX idx_judge_activity_logs_created_at ON judge_activity_logs(created_at DESC);
CREATE INDEX idx_judge_activity_logs_action ON judge_activity_logs(action);
