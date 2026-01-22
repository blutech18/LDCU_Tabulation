-- ============================================================
-- MIGRATION: Add gender constraint to participants table
-- Restricts gender values to only 'male' or 'female'
-- ============================================================

-- Add CHECK constraint to enforce gender values
ALTER TABLE participants 
ADD CONSTRAINT participants_gender_check 
CHECK (gender IS NULL OR gender IN ('male', 'female'));

-- Update any existing invalid gender values to NULL (optional cleanup)
-- Uncomment the following line if you want to clean up existing data
-- UPDATE participants SET gender = NULL WHERE gender NOT IN ('male', 'female');
