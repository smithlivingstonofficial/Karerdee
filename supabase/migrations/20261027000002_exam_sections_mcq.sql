-- ==============================================================================
-- Migration: 20261027000002_exam_sections_mcq.sql
-- Description: Modular Exam Sections, Department Routing & MCQ-Only Optimization
-- ==============================================================================

-- 1. Add Negative Marking configuration to Exams
ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS enable_negative_marking BOOLEAN NOT NULL DEFAULT false;

-- 2. Create Exam Sections table
CREATE TABLE IF NOT EXISTS exam_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_common BOOLEAN NOT NULL DEFAULT true,
    target_departments TEXT[] DEFAULT '{}', -- e.g. ARRAY['MCA', 'CSE'] or empty if is_common = true
    default_points DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    default_negative_points DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    order_index INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Link Questions to Sections
ALTER TABLE exam_questions 
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES exam_sections(id) ON DELETE CASCADE;

-- 4. Indexes for fast section lookups
CREATE INDEX IF NOT EXISTS idx_exam_sections_exam ON exam_sections(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_section ON exam_questions(section_id);

-- 5. Enable Row-Level Security on Sections
ALTER TABLE exam_sections ENABLE ROW LEVEL SECURITY;

