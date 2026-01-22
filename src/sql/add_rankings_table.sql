-- ============================================================
-- ADD RANKINGS TABLE FOR RANKING-BASED TABULATION
-- ============================================================
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Paste and click "Run"
-- 
-- This adds support for ranking-based categories where judges
-- rank contestants instead of scoring them
-- ============================================================

-- Rankings: For ranking-based tabulation
CREATE TABLE IF NOT EXISTS rankings (
  id SERIAL PRIMARY KEY,
  judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  contestant_id INTEGER NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL,
  status TEXT DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT rankings_status_check CHECK (status IN ('draft', 'submitted', 'locked')),
  CONSTRAINT rankings_unique UNIQUE(judge_id, contestant_id, category_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rankings_judge ON rankings(judge_id);
CREATE INDEX IF NOT EXISTS idx_rankings_contestant ON rankings(contestant_id);
CREATE INDEX IF NOT EXISTS idx_rankings_category ON rankings(category_id);
CREATE INDEX IF NOT EXISTS idx_rankings_status ON rankings(status);

-- Add trigger for updated_at
CREATE TRIGGER tr_rankings_updated_at 
  BEFORE UPDATE ON rankings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (same as scores table)
CREATE POLICY "rankings_select_all" ON rankings FOR SELECT USING (true);
CREATE POLICY "rankings_insert_all" ON rankings FOR INSERT WITH CHECK (true);
CREATE POLICY "rankings_update_all" ON rankings FOR UPDATE USING (true);
CREATE POLICY "rankings_delete_all" ON rankings FOR DELETE USING (true);

-- Create view for rankings with full details
CREATE OR REPLACE VIEW v_rankings_full AS
SELECT 
  r.*,
  j.name AS judge_name,
  j.code AS judge_code,
  ct.name AS contestant_name,
  ct.contestant_number,
  ct.department AS contestant_department,
  cat.name AS category_name,
  cat.tabular_type
FROM rankings r
JOIN judges j ON r.judge_id = j.id
JOIN contestants ct ON r.contestant_id = ct.id
JOIN categories cat ON r.category_id = cat.id;
