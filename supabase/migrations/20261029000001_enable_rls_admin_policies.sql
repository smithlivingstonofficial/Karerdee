-- ==============================================================================
-- Migration: 20261029000001_enable_rls_admin_policies.sql
-- Description: Grant full access policies to authenticated admin accounts
-- Target: Supabase PostgreSQL
-- ==============================================================================

-- 1. Departments policies
DROP POLICY IF EXISTS "Allow authenticated all on departments" ON departments;
CREATE POLICY "Allow authenticated all on departments" 
ON departments FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Students policies
DROP POLICY IF EXISTS "Allow authenticated all on students" ON students;
CREATE POLICY "Allow authenticated all on students" 
ON students FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Courses policies
DROP POLICY IF EXISTS "Allow authenticated all on courses" ON courses;
CREATE POLICY "Allow authenticated all on courses" 
ON courses FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Batches policies
DROP POLICY IF EXISTS "Allow authenticated all on batches" ON batches;
CREATE POLICY "Allow authenticated all on batches" 
ON batches FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Exams policies
DROP POLICY IF EXISTS "Allow authenticated all on exams" ON exams;
CREATE POLICY "Allow authenticated all on exams" 
ON exams FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 6. Exam Sections policies
DROP POLICY IF EXISTS "Allow authenticated all on exam_sections" ON exam_sections;
CREATE POLICY "Allow authenticated all on exam_sections" 
ON exam_sections FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 7. Exam Questions policies
DROP POLICY IF EXISTS "Allow authenticated all on exam_questions" ON exam_questions;
CREATE POLICY "Allow authenticated all on exam_questions" 
ON exam_questions FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 8. Question Options policies
DROP POLICY IF EXISTS "Allow authenticated all on question_options" ON question_options;
CREATE POLICY "Allow authenticated all on question_options" 
ON question_options FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 9. Exam Sessions policies
DROP POLICY IF EXISTS "Allow authenticated all on exam_sessions" ON exam_sessions;
CREATE POLICY "Allow authenticated all on exam_sessions" 
ON exam_sessions FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 10. Violation Logs policies
DROP POLICY IF EXISTS "Allow authenticated all on violation_logs" ON violation_logs;
CREATE POLICY "Allow authenticated all on violation_logs" 
ON violation_logs FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 11. Proctor Actions policies
DROP POLICY IF EXISTS "Allow authenticated all on proctor_actions" ON proctor_actions;
CREATE POLICY "Allow authenticated all on proctor_actions" 
ON proctor_actions FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

