-- ==============================================================================
-- Migration: 20261027000001_initial_schema.sql
-- Description: Core schema for Safe Exam Platform (Site-3.0)
-- Target: Supabase PostgreSQL
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Academic Entities
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    roll_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Examination Management
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    passcode TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    max_strikes INT NOT NULL DEFAULT 3,
    randomize_questions BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK (question_type IN ('MCQ_SINGLE', 'MCQ_MULTIPLE', 'SUBJECTIVE')),
    prompt TEXT NOT NULL,
    code_snippet TEXT,
    points DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    negative_points DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    min_words INT,
    max_words INT,
    rubric_criteria JSONB,
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INT NOT NULL
);

-- 4. Session & Realtime Telemetry
CREATE TABLE IF NOT EXISTS exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    hardware_fingerprint TEXT NOT NULL,
    client_version TEXT,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'PAUSED', 'LOCKED', 'SUBMITTED', 'DISQUALIFIED')),
    strikes_count INT NOT NULL DEFAULT 0,
    extra_time_minutes INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    submitted_at TIMESTAMPTZ,
    auto_score DECIMAL(6, 2) DEFAULT 0.00,
    final_score DECIMAL(6, 2),
    is_evaluated BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE RESTRICT,
    selected_option_ids UUID[] DEFAULT '{}',
    subjective_text TEXT,
    is_auto_graded BOOLEAN NOT NULL DEFAULT false,
    awarded_points DECIMAL(5, 2),
    evaluator_remarks TEXT,
    evaluated_by UUID REFERENCES auth.users(id),
    evaluated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(session_id, question_id)
);

CREATE TABLE IF NOT EXISTS violation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL CHECK (violation_type IN (
        'NO_FACE',
        'MULTIPLE_FACES',
        'BLACK_LISTED_PROCESS',
        'MULTI_MONITOR_DETECTED',
        'SCREEN_CAPTURE_ATTEMPT',
        'SYSTEM_HOTKEY_ATTEMPT',
        'VM_DETECTED',
        'WINDOW_UNFOCUSED'
    )),
    strike_number INT NOT NULL,
    snapshot_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS proctor_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    proctor_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL CHECK (action_type IN ('PAUSE', 'RESUME', 'ADD_TIME', 'UNLOCK', 'WARN', 'FORCE_SUBMIT')),
    reason TEXT,
    action_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_courses_dept ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_batches_dept ON batches(department_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_exams_course ON exams(course_id);
CREATE INDEX IF NOT EXISTS idx_exams_passcode ON exams(passcode);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_question_options_q ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student ON exam_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_session ON submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_session ON violation_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_proctor_actions_session ON proctor_actions(session_id);

-- 6. Enable Row-Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctor_actions ENABLE ROW LEVEL SECURITY;

-- 7. Add Tables to Supabase Realtime Publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'exam_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE exam_sessions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'violation_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE violation_logs;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'proctor_actions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE proctor_actions;
    END IF;
END $$;

