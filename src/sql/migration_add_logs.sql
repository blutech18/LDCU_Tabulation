-- ============================================================
-- MIGRATION: ADD ACTIVITY LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id), -- Optional: link to Supabase Auth user
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Flexible field for extra details
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all reads for authenticated users (admins)
CREATE POLICY "activity_logs_read_all" ON activity_logs 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Policy: Allow inserts for authenticated users (system logging)
CREATE POLICY "activity_logs_insert_all" ON activity_logs 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Create index for faster querying by date
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
