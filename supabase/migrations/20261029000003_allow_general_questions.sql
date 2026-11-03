-- ==============================================================================
-- Migration: 20261029000003_allow_general_questions.sql
-- Description: Allow General / Common Core Questions (department_id IS NULL)
-- Target: Supabase PostgreSQL
-- ==============================================================================

-- 1. Allow department_id to be NULL for General / Common Core Questions
ALTER TABLE department_questions ALTER COLUMN department_id DROP NOT NULL;

-- 2. Index for filtering General Questions quickly
CREATE INDEX IF NOT EXISTS idx_dept_questions_general ON department_questions(department_id) WHERE department_id IS NULL;

