-- ==============================================================================
-- Migration: 20261028000001_streamline_students.sql
-- Description: Streamline Students for KARE-SES:
--              Student Name, Email, Department, Application Number
-- ==============================================================================

-- 1. Make batch_id optional
ALTER TABLE students ALTER COLUMN batch_id DROP NOT NULL;

-- 2. Add direct department reference & application number
ALTER TABLE students ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS application_number TEXT;

-- 3. Ensure uniqueness on application_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_app_number ON students(application_number) WHERE application_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id);
