# Database Schema & Data Dictionary

This document specifies the PostgreSQL relational schema implemented in **Supabase**.

---

## 1. Entity Relationship Overview

```
departments
 └── courses
      └── exams
           ├── exam_questions
           │    ├── question_options (for MCQs)
           │    └── submissions (answers + evaluation)
           ├── exam_sessions (candidate test runs)
           │    ├── submissions
           │    ├── violation_logs (AI & OS flags + snapshot URLs)
           │    └── proctor_actions (audit trail of admin overrides)
           └── batches (scheduled student groups)
```

---

## 2. Table Specifications & DDL

### 2.1 Academic Structure

```sql
-- Departments within the institution
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Academic Courses / Subjects
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Student Batches (e.g., MCA 2024-2026 Batch A)
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Registered Candidates / Students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    roll_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

---

### 2.2 Examination Management

```sql
-- Exams definition
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    passcode TEXT NOT NULL, -- Secret 6-8 char code for client authentication
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    max_strikes INT NOT NULL DEFAULT 3,
    randomize_questions BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Questions belonging to an exam
CREATE TABLE exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK (question_type IN ('MCQ_SINGLE', 'MCQ_MULTIPLE', 'SUBJECTIVE')),
    prompt TEXT NOT NULL,
    code_snippet TEXT,
    points DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    negative_points DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    min_words INT, -- For essay/subjective questions
    max_words INT,
    rubric_criteria JSONB, -- Criteria & scoring guide for evaluators
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Multiple choice options
CREATE TABLE question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    order_index INT NOT NULL
);
```

---

### 2.3 Live Session & Telemetry

```sql
-- Active and finished candidate exam attempts
CREATE TABLE exam_sessions (
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

-- Candidate answer submissions
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE RESTRICT,
    selected_option_ids UUID[] DEFAULT '{}', -- For MCQ
    subjective_text TEXT, -- For Subjective/Essay
    is_auto_graded BOOLEAN NOT NULL DEFAULT false,
    awarded_points DECIMAL(5, 2),
    evaluator_remarks TEXT,
    evaluated_by UUID REFERENCES auth.users(id),
    evaluated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(session_id, question_id)
);

-- Violation logs with snapshot proofs
CREATE TABLE violation_logs (
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
    snapshot_url TEXT, -- URL in Supabase Storage
    metadata JSONB, -- Diagnostic details (e.g., process name, screen count)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Proctor audit trail (Remote interventions)
CREATE TABLE proctor_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    proctor_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL CHECK (action_type IN ('PAUSE', 'RESUME', 'ADD_TIME', 'UNLOCK', 'WARN', 'FORCE_SUBMIT')),
    reason TEXT,
    action_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

---

## 3. Row-Level Security (RLS) & Policies

1. **Candidate Client Restrictions**:
   - The Windows Client **does not directly query Supabase tables**.
   - All client interaction passes through Next.js API route handlers authenticated via session tokens (`Bearer <JWT>`).
   - This ensures candidates cannot spoof answers, read answer keys, or tamper with other students' records.
2. **Faculty / Admin Portal**:
   - Faculty members can only view and modify exams associated with their assigned courses.
   - Evaluators can view submissions in an anonymized format (without student roll numbers or personal identifiers) if blind evaluation is enabled.
3. **Storage Bucket Policy (`exam-violations`)**:
   - Write: Allowed only via backend service role key when the client posts a verified violation frame.
   - Read: Restricted to authenticated faculty and proctor roles.

