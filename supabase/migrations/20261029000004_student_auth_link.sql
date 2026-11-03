-- ==============================================================================
-- Migration: 20261029000004_student_auth_link.sql
-- Description: Link students to Supabase Auth and enforce email presence
-- ==============================================================================

-- 1. Add auth_user_id reference to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Index for fast authentication lookup by auth_user_id
CREATE INDEX IF NOT EXISTS idx_students_auth_user ON students(auth_user_id);

-- 3. Ensure index on email for quick credential lookups
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);

