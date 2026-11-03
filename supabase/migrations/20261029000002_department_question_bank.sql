-- ==============================================================================
-- Migration: 20261029000002_department_question_bank.sql
-- Description: Department Question Bank & Reusable MCQ Repository
-- Target: Supabase PostgreSQL
-- ==============================================================================

-- 1. Department Questions Table
CREATE TABLE IF NOT EXISTS department_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    topic TEXT NOT NULL DEFAULT 'General',
    difficulty TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    question_type TEXT NOT NULL DEFAULT 'MCQ_SINGLE' CHECK (question_type IN ('MCQ_SINGLE', 'MCQ_MULTIPLE')),
    prompt TEXT NOT NULL,
    code_snippet TEXT,
    default_points DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    default_negative_points DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Department Question Options Table
CREATE TABLE IF NOT EXISTS department_question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES department_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INT NOT NULL
);

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_dept_questions_dept ON department_questions(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_questions_topic ON department_questions(topic);
CREATE INDEX IF NOT EXISTS idx_dept_options_q ON department_question_options(question_id);

-- 4. Enable Row-Level Security
ALTER TABLE department_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_question_options ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Authenticated Administrators
DROP POLICY IF EXISTS "Allow authenticated all on department_questions" ON department_questions;
CREATE POLICY "Allow authenticated all on department_questions" 
ON department_questions FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all on department_question_options" ON department_question_options;
CREATE POLICY "Allow authenticated all on department_question_options" 
ON department_question_options FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

