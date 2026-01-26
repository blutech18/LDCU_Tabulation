-- ============================================================
-- AUDITORS TABLE - Users who can view event results
-- ============================================================

CREATE TABLE IF NOT EXISTS auditors (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE, -- Login code for auditor
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_auditors_event ON auditors(event_id);
CREATE INDEX IF NOT EXISTS idx_auditors_code ON auditors(code);

-- Enable RLS
ALTER TABLE auditors ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "auditors_all" ON auditors FOR ALL USING (true) WITH CHECK (true);
