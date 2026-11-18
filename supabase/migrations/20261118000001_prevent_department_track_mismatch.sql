-- ==============================================================================
-- Migration: 20261118000001_prevent_department_track_mismatch.sql
-- Description: Strict Academic Integrity Barrier - Prevent Department Track Mismatches
-- Target: Supabase PostgreSQL (exam_questions, exam_sections, department_questions)
-- ==============================================================================

-- 1. Create Validation Trigger Function
CREATE OR REPLACE FUNCTION validate_exam_question_department_track()
RETURNS TRIGGER AS $$
DECLARE
    v_is_common BOOLEAN;
    v_target_depts TEXT[];
    v_question_dept TEXT;
    v_source_q_id UUID;
    v_source_dept_code TEXT;
BEGIN
    -- Look up parent exam section configuration
    SELECT is_common, target_departments 
    INTO v_is_common, v_target_depts
    FROM exam_sections
    WHERE id = NEW.section_id;

    -- If section does not exist, let foreign key constraint handle it
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Extract target_department from JSONB rubric_criteria
    IF NEW.rubric_criteria IS NOT NULL AND NEW.rubric_criteria ? 'target_department' THEN
        v_question_dept := UPPER(TRIM(NEW.rubric_criteria->>'target_department'));
    ELSE
        v_question_dept := NULL;
    END IF;

    -- CASE 1: Department Specialization Section (is_common = false)
    IF v_is_common = false THEN
        -- Every question in a department elective section MUST have a target_department
        IF v_question_dept IS NULL OR v_question_dept = '' THEN
            RAISE EXCEPTION 'Academic Integrity Violation: Question "%" in elective section "%" must specify target_department in rubric_criteria.', 
                LEFT(NEW.prompt, 40), NEW.section_id
                USING ERRCODE = 'check_violation';
        END IF;

        -- target_department must be authorized in exam_sections.target_departments
        IF array_length(v_target_depts, 1) > 0 AND NOT (v_question_dept = ANY(v_target_depts)) THEN
            RAISE EXCEPTION 'Academic Integrity Violation: Department "%" is not authorized in section "%". Permitted tracks: %',
                v_question_dept, NEW.section_id, array_to_string(v_target_depts, ', ')
                USING ERRCODE = 'check_violation';
        END IF;

        -- CASE 1B: If imported from Question Bank, verify source question department
        IF NEW.rubric_criteria ? 'source_question_id' AND (NEW.rubric_criteria->>'source_question_id') IS NOT NULL THEN
            BEGIN
                v_source_q_id := (NEW.rubric_criteria->>'source_question_id')::UUID;
                
                SELECT UPPER(TRIM(d.code))
                INTO v_source_dept_code
                FROM department_questions dq
                JOIN departments d ON dq.department_id = d.id
                WHERE dq.id = v_source_q_id;

                IF FOUND AND v_source_dept_code IS NOT NULL AND v_source_dept_code <> 'GENERAL' THEN
                    IF v_source_dept_code <> v_question_dept THEN
                        RAISE EXCEPTION 'Academic Integrity Security Barrier: Source question % belongs to department "%" but was inserted into "%" track. Cross-department track contamination is strictly prohibited.',
                            v_source_q_id, v_source_dept_code, v_question_dept
                            USING ERRCODE = 'check_violation';
                    END IF;
                END IF;
            EXCEPTION
                WHEN invalid_text_representation THEN
                    -- Ignore non-UUID source ids (e.g., temporary client ids)
                    NULL;
            END;
        END IF;

    -- CASE 2: Common Core Section (is_common = true)
    ELSE
        -- Common sections should not restrict to a specialized department
        IF v_question_dept IS NOT NULL AND v_question_dept NOT IN ('COMMON', 'GENERAL', '') THEN
            RAISE EXCEPTION 'Academic Integrity Violation: Common Core section "%" cannot host department-specialized question for "%".',
                NEW.section_id, v_question_dept
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_validate_exam_question_department_track ON exam_questions;

CREATE TRIGGER trg_validate_exam_question_department_track
BEFORE INSERT OR UPDATE OF section_id, rubric_criteria ON exam_questions
FOR EACH ROW
EXECUTE FUNCTION validate_exam_question_department_track();

-- 3. Document Trigger in Comments
COMMENT ON FUNCTION validate_exam_question_department_track() IS 
'Enforces strict academic track isolation: ensures questions in department tracks belong exclusively to that department and cannot leak across tracks.';
