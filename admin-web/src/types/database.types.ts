export type QuestionType = "MCQ_SINGLE" | "MCQ_MULTIPLE";
export type ExamStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type SessionStatus = "IN_PROGRESS" | "PAUSED" | "LOCKED" | "SUBMITTED" | "DISQUALIFIED";
export type ViolationType =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "BLACK_LISTED_PROCESS"
  | "MULTI_MONITOR_DETECTED"
  | "SCREEN_CAPTURE_ATTEMPT"
  | "SYSTEM_HOTKEY_ATTEMPT"
  | "VM_DETECTED"
  | "WINDOW_UNFOCUSED";
export type ProctorActionType = "PAUSE" | "RESUME" | "ADD_TIME" | "UNLOCK" | "WARN" | "FORCE_SUBMIT";

export interface Department {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface DepartmentQuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
}

export interface DepartmentQuestion {
  id: string;
  department_id?: string | null;
  topic: string;
  difficulty: QuestionDifficulty;
  question_type: QuestionType;
  prompt: string;
  code_snippet?: string | null;
  default_points: number;
  default_negative_points: number;
  created_at: string;
  department?: Department | null;
  options?: DepartmentQuestionOption[];
}

export interface Course {
  id: string;
  department_id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export interface Batch {
  id: string;
  department_id: string;
  name: string;
  academic_year: string;
  created_at: string;
}

export interface Student {
  id: string;
  auth_user_id?: string | null;
  department_id?: string;
  batch_id?: string;
  roll_number?: string;
  application_number: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  department?: Department;
}

export interface Exam {
  id: string;
  course_id?: string;
  course_code?: string;
  title: string;
  description?: string;
  instructions?: string;
  passcode: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  max_strikes: number;
  randomize_questions: boolean;
  enable_negative_marking: boolean;
  status: ExamStatus;
  config?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface ExamSection {
  id: string;
  exam_id: string;
  title: string;
  description?: string;
  is_common: boolean;
  target_departments: string[];
  default_points: number;
  default_negative_points: number;
  order_index: number;
  config?: Record<string, any>;
  created_at: string;
  questions?: ExamQuestion[];
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct?: boolean; // Stripped before dispatching to client
  order_index: number;
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  section_id?: string;
  question_type: QuestionType;
  prompt: string;
  code_snippet?: string;
  points: number;
  negative_points: number;
  min_words?: number;
  max_words?: number;
  rubric_criteria?: any;
  order_index: number;
  created_at: string;
  question_options?: QuestionOption[];
}

export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  hardware_fingerprint: string;
  client_version?: string;
  status: SessionStatus;
  strikes_count: number;
  extra_time_minutes: number;
  started_at: string;
  submitted_at?: string;
  auto_score?: number;
  final_score?: number;
  is_evaluated: boolean;
}

export interface Submission {
  id: string;
  session_id: string;
  question_id: string;
  selected_option_ids?: string[];
  subjective_text?: string;
  is_auto_graded: boolean;
  awarded_points?: number;
  evaluator_remarks?: string;
  evaluated_by?: string;
  evaluated_at?: string;
  last_synced_at: string;
}

export interface ViolationLog {
  id: string;
  session_id: string;
  violation_type: ViolationType;
  strike_number: number;
  snapshot_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ProctorAction {
  id: string;
  session_id: string;
  proctor_id?: string;
  action_type: ProctorActionType;
  reason?: string;
  action_payload?: Record<string, any>;
  created_at: string;
}

