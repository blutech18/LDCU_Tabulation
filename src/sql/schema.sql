-- ============================================================
-- LDCU TABULATION SYSTEM - OPTIMIZED DATABASE SCHEMA
-- Supports both Scoring-based and Ranking-based tabulation
-- ============================================================
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Paste and click "Run"
-- 
-- This migration adds event_id to judges and contestants tables
-- and removes unused sub_criteria tables
-- ============================================================

-- ============================================================
-- MIGRATION: Add event_id to existing tables
-- ============================================================

-- Add event_id to judges if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'judges' AND column_name = 'event_id'
    ) THEN
        ALTER TABLE judges ADD COLUMN event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;
        CREATE INDEX idx_judges_event ON judges(event_id);
    END IF;
END $$;

-- Add event_id to contestants if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contestants' AND column_name = 'event_id'
    ) THEN
        ALTER TABLE contestants ADD COLUMN event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;
        CREATE INDEX idx_contestants_event ON contestants(event_id);
    END IF;
END $$;

-- Drop unused sub_criteria tables if they exist
DROP TABLE IF EXISTS sub_score_details CASCADE;
DROP TABLE IF EXISTS sub_criteria CASCADE;
DROP TABLE IF EXISTS contestant_assignments CASCADE;

-- ============================================================
-- FULL SCHEMA (for reference or fresh install)
-- Comment out the migration section above and uncomment below
-- if you want a fresh install
-- ============================================================

/*
-- Enable UUID extension for Supabase Auth
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DROP EXISTING TABLES (for clean install)
DROP TABLE IF EXISTS score_history CASCADE;
DROP TABLE IF EXISTS category_results CASCADE;
DROP TABLE IF EXISTS sub_score_details CASCADE;
DROP TABLE IF EXISTS score_details CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS judge_assignments CASCADE;
DROP TABLE IF EXISTS contestant_assignments CASCADE;
DROP TABLE IF EXISTS sub_criteria CASCADE;
DROP TABLE IF EXISTS category_criteria CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS contestants CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- Events: Main competitions/pageants
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  venue TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT events_status_check CHECK (status IN ('draft', 'upcoming', 'ongoing', 'completed', 'archived'))
);

-- Categories: Individual segments within events
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tabular_type TEXT DEFAULT 'scoring',
  score_min INTEGER DEFAULT 1,
  score_max INTEGER DEFAULT 10,
  require_percentage_total BOOLEAN DEFAULT TRUE,
  schedule_start TIMESTAMPTZ,
  schedule_end TIMESTAMPTZ,
  photo_url TEXT,
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  manual_override BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT categories_tabular_type_check CHECK (tabular_type IN ('scoring', 'ranking')),
  CONSTRAINT categories_status_check CHECK (status IN ('scheduled', 'active', 'paused', 'completed'))
);

-- Contestants/Participants (Event-specific)
CREATE TABLE contestants (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contestant_number INTEGER,
  name TEXT NOT NULL,
  nickname TEXT,
  department TEXT NOT NULL,
  course TEXT,
  photo_url TEXT,
  bio TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Judges (Event-specific)
CREATE TABLE judges (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  affiliation TEXT,
  code TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category Criteria: Flat criteria for each category
CREATE TABLE category_criteria (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  percentage INTEGER NOT NULL DEFAULT 0,
  min_score INTEGER,
  max_score INTEGER,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Judge-Category Assignments
CREATE TABLE judge_assignments (
  id SERIAL PRIMARY KEY,
  judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT judge_assignments_unique UNIQUE(judge_id, category_id)
);

-- Scores: Main score record
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  contestant_id INTEGER NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  total_score NUMERIC(10,4) DEFAULT 0,
  computed_rank INTEGER,
  status TEXT DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT scores_status_check CHECK (status IN ('draft', 'submitted', 'locked')),
  CONSTRAINT scores_unique UNIQUE(judge_id, contestant_id, category_id)
);

-- Score Details: Individual scores per criteria
CREATE TABLE score_details (
  id SERIAL PRIMARY KEY,
  score_id INTEGER NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  category_criteria_id INTEGER NOT NULL REFERENCES category_criteria(id) ON DELETE CASCADE,
  raw_score NUMERIC(10,4) NOT NULL DEFAULT 0,
  weighted_score NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT score_details_unique UNIQUE(score_id, category_criteria_id)
);

-- Category Results: Aggregated results
CREATE TABLE category_results (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  contestant_id INTEGER NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  average_score NUMERIC(10,4) DEFAULT 0,
  final_rank INTEGER,
  judge_count INTEGER DEFAULT 0,
  tiebreaker_score NUMERIC(10,4),
  is_finalized BOOLEAN DEFAULT FALSE,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT category_results_unique UNIQUE(category_id, contestant_id)
);

-- Score History: Audit trail
CREATE TABLE score_history (
  id SERIAL PRIMARY KEY,
  score_id INTEGER NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  previous_total NUMERIC(10,4),
  new_total NUMERIC(10,4),
  previous_status TEXT,
  new_status TEXT,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_categories_event ON categories(event_id);
CREATE INDEX idx_categories_status ON categories(status);
CREATE INDEX idx_contestants_event ON contestants(event_id);
CREATE INDEX idx_contestants_active ON contestants(is_active);
CREATE INDEX idx_judges_event ON judges(event_id);
CREATE INDEX idx_judges_code ON judges(code);
CREATE INDEX idx_judges_active ON judges(is_active);
CREATE INDEX idx_category_criteria_category ON category_criteria(category_id);
CREATE INDEX idx_judge_assignments_judge ON judge_assignments(judge_id);
CREATE INDEX idx_judge_assignments_category ON judge_assignments(category_id);
CREATE INDEX idx_scores_judge ON scores(judge_id);
CREATE INDEX idx_scores_contestant ON scores(contestant_id);
CREATE INDEX idx_scores_category ON scores(category_id);
CREATE INDEX idx_scores_status ON scores(status);
CREATE INDEX idx_score_details_score ON score_details(score_id);
CREATE INDEX idx_category_results_category ON category_results(category_id);
CREATE INDEX idx_category_results_contestant ON category_results(contestant_id);

-- VIEWS
CREATE OR REPLACE VIEW v_categories_with_event AS
SELECT 
  c.*,
  e.name AS event_name,
  e.date AS event_date,
  e.status AS event_status
FROM categories c
JOIN events e ON c.event_id = e.id;

CREATE OR REPLACE VIEW v_scores_full AS
SELECT 
  s.*,
  j.name AS judge_name,
  j.code AS judge_code,
  ct.name AS contestant_name,
  ct.department AS contestant_department,
  cat.name AS category_name,
  cat.tabular_type
FROM scores s
JOIN judges j ON s.judge_id = j.id
JOIN contestants ct ON s.contestant_id = ct.id
JOIN categories cat ON s.category_id = cat.id;

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_events_updated_at 
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_categories_updated_at 
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_contestants_updated_at 
  BEFORE UPDATE ON contestants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_judges_updated_at 
  BEFORE UPDATE ON judges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_scores_updated_at 
  BEFORE UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_score_details_updated_at 
  BEFORE UPDATE ON score_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_category_results_updated_at 
  BEFORE UPDATE ON category_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROW LEVEL SECURITY
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "events_select_all" ON events FOR SELECT USING (true);
CREATE POLICY "events_insert_authenticated" ON events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "events_update_authenticated" ON events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "events_delete_authenticated" ON events FOR DELETE TO authenticated USING (true);

CREATE POLICY "categories_select_all" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_insert_authenticated" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "categories_update_authenticated" ON categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "categories_delete_authenticated" ON categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "contestants_select_all" ON contestants FOR SELECT USING (true);
CREATE POLICY "contestants_insert_authenticated" ON contestants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contestants_update_authenticated" ON contestants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contestants_delete_authenticated" ON contestants FOR DELETE TO authenticated USING (true);

CREATE POLICY "judges_select_all" ON judges FOR SELECT USING (true);
CREATE POLICY "judges_insert_authenticated" ON judges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "judges_update_authenticated" ON judges FOR UPDATE TO authenticated USING (true);
CREATE POLICY "judges_delete_authenticated" ON judges FOR DELETE TO authenticated USING (true);

CREATE POLICY "category_criteria_select_all" ON category_criteria FOR SELECT USING (true);
CREATE POLICY "category_criteria_insert_authenticated" ON category_criteria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "category_criteria_update_authenticated" ON category_criteria FOR UPDATE TO authenticated USING (true);
CREATE POLICY "category_criteria_delete_authenticated" ON category_criteria FOR DELETE TO authenticated USING (true);

CREATE POLICY "judge_assignments_select_all" ON judge_assignments FOR SELECT USING (true);
CREATE POLICY "judge_assignments_insert_authenticated" ON judge_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "judge_assignments_update_authenticated" ON judge_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "judge_assignments_delete_authenticated" ON judge_assignments FOR DELETE TO authenticated USING (true);

CREATE POLICY "scores_select_all" ON scores FOR SELECT USING (true);
CREATE POLICY "scores_insert_all" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "scores_update_all" ON scores FOR UPDATE USING (true);
CREATE POLICY "scores_delete_authenticated" ON scores FOR DELETE TO authenticated USING (true);

CREATE POLICY "score_details_select_all" ON score_details FOR SELECT USING (true);
CREATE POLICY "score_details_insert_all" ON score_details FOR INSERT WITH CHECK (true);
CREATE POLICY "score_details_update_all" ON score_details FOR UPDATE USING (true);
CREATE POLICY "score_details_delete_all" ON score_details FOR DELETE USING (true);

CREATE POLICY "category_results_select_all" ON category_results FOR SELECT USING (true);
CREATE POLICY "category_results_insert_authenticated" ON category_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "category_results_update_authenticated" ON category_results FOR UPDATE TO authenticated USING (true);

CREATE POLICY "score_history_select_authenticated" ON score_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "score_history_insert_all" ON score_history FOR INSERT WITH CHECK (true);
*/
