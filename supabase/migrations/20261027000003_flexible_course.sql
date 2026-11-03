-- ==============================================================================
-- Migration: 20261027000003_flexible_course.sql
-- Description: Allow flexible course code and optional course_id for multi-department exams
-- ==============================================================================

ALTER TABLE exams ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS course_code TEXT;

