-- ============================================================
-- LDCU TABULATION SYSTEM - MINIMAL OPTIMIZED SCHEMA
-- Simple: Events → Categories → Criteria → Participants → Scores
-- ============================================================

-- DROP ALL EXISTING TABLES (Clean Install)
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS judge_assignments CASCADE;
DROP TABLE IF EXISTS criteria CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- ============================================================
-- 1. EVENTS - Main competitions/pageants
-- ============================================================
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  event_start DATE,
  end_date DATE,
  event_end DATE,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  participant_type TEXT DEFAULT 'individual', -- 'individual' or 'group'
  status TEXT DEFAULT 'draft', -- draft, ongoing, completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. CATEGORIES - Segments within events (e.g., Best in Talent)
-- ============================================================
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tabular_type TEXT DEFAULT 'scoring', -- 'scoring' or 'ranking'
  score_min INTEGER DEFAULT 1,
  score_max INTEGER DEFAULT 10,
  photo_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CRITERIA - Scoring criteria for each category
-- ============================================================
CREATE TABLE criteria (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  percentage INTEGER DEFAULT 0, -- For scoring type (must total 100%)
  min_score INTEGER DEFAULT 1,  -- For ranking type
  max_score INTEGER DEFAULT 10, -- For ranking type
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. PARTICIPANTS - Contestants or Groups
-- ============================================================
CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  number INTEGER, -- Participant number
  name TEXT NOT NULL,
  department TEXT,
  gender TEXT, -- For individual type events
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. JUDGES - Event judges with access codes
-- ============================================================
CREATE TABLE judges (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE, -- Login code for judge
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. JUDGE ASSIGNMENTS - Assign judges to specific categories
-- ============================================================
CREATE TABLE judge_assignments (
  id SERIAL PRIMARY KEY,
  judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT judge_category_unique UNIQUE(judge_id, category_id)
);

-- ============================================================
-- 7. SCORES - Judge scores (one per judge/participant/criteria)
-- ============================================================
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  criteria_id INTEGER NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  score NUMERIC(10,2) NOT NULL DEFAULT 0,
  rank INTEGER, -- For ranking type categories
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT scores_unique UNIQUE(judge_id, participant_id, criteria_id)
);

-- ============================================================
-- INDEXES for Performance
-- ============================================================
CREATE INDEX idx_categories_event ON categories(event_id);
CREATE INDEX idx_criteria_category ON criteria(category_id);
CREATE INDEX idx_participants_event ON participants(event_id);
CREATE INDEX idx_judges_event ON judges(event_id);
CREATE INDEX idx_judges_code ON judges(code);
CREATE INDEX idx_judge_assignments_judge ON judge_assignments(judge_id);
CREATE INDEX idx_judge_assignments_category ON judge_assignments(category_id);
CREATE INDEX idx_scores_judge ON scores(judge_id);
CREATE INDEX idx_scores_participant ON scores(participant_id);
CREATE INDEX idx_scores_criteria ON scores(criteria_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES - Allow all access (adjust as needed)
-- ============================================================
-- Events
CREATE POLICY "events_all" ON events FOR ALL USING (true) WITH CHECK (true);

-- Categories
CREATE POLICY "categories_all" ON categories FOR ALL USING (true) WITH CHECK (true);

-- Criteria
CREATE POLICY "criteria_all" ON criteria FOR ALL USING (true) WITH CHECK (true);

-- Participants
CREATE POLICY "participants_all" ON participants FOR ALL USING (true) WITH CHECK (true);

-- Judges
CREATE POLICY "judges_all" ON judges FOR ALL USING (true) WITH CHECK (true);

-- Judge Assignments
CREATE POLICY "judge_assignments_all" ON judge_assignments FOR ALL USING (true) WITH CHECK (true);

-- Scores
CREATE POLICY "scores_all" ON scores FOR ALL USING (true) WITH CHECK (true);
