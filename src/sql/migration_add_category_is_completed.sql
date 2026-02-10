-- Migration: Add is_completed column to categories table
-- When a category is marked as completed, its scores show as 0 in auditor results
-- but the actual data is preserved in the database

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN categories.is_completed IS 'When true, this category scores display as 0 in auditor results while preserving actual data';
