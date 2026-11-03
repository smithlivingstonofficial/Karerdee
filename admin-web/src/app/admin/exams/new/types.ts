export interface OptionState {
  id: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

export interface QuestionState {
  id: string;
  sectionId: string;
  targetDepartment?: string | null;
  questionType: "MCQ_SINGLE" | "MCQ_MULTIPLE";
  prompt: string;
  codeSnippet?: string;
  points: number;
  negativePoints: number;
  orderIndex: number;
  options: OptionState[];
  sourceQuestionId?: string;
  sourceDepartment?: string | null;
}

export interface SectionState {
  id: string;
  title: string;
  isCommon: boolean;
  targetDepartments: string[];
  defaultPoints: number;
  defaultNegativePoints: number;
  orderIndex: number;
  navigationMode: "FLEXIBLE" | "SEQUENTIAL";
  timeLimitMinutes?: number | null;
  targetQuestionCount?: number | null;
}

export interface LockdownPolicyState {
  blockKeyboardHooks: boolean;
  blockDisplayAffinity: boolean;
  blockMultipleMonitors: boolean;
  blockVirtualMachines: boolean;
  blockBlacklistedProcesses: boolean;
  lockHardwareFingerprint: boolean;
}

export interface ExamGeneralState {
  title: string;
  courseCode: string;
  description: string;
  instructions: string;
  passcode: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  lateEntryBufferMinutes: number;
  earlySubmissionMinPercent: number;
  maxStrikes: number;
  strikeAction: "LOCK_WORKSTATION" | "FORCE_SUBMIT" | "FLAG_SILENT";
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  enableNegativeMarking: boolean;
  calculatorMode: "NONE" | "BASIC" | "SCIENTIFIC";
  enableScratchpad: boolean;
  enableQuestionFlagging: boolean;
  lockdownPolicy: LockdownPolicyState;
}

export interface QuestionBankItem {
  id: string;
  department_id: string | null;
  department?: {
    code: string;
    name: string;
  } | null;
  topic?: string;
  question_type: "MCQ_SINGLE" | "MCQ_MULTIPLE";
  prompt: string;
  code_snippet?: string | null;
  points: number;
  negative_points: number;
  difficulty?: string;
  options: {
    id: string;
    option_text: string;
    is_correct: boolean;
    order_index: number;
  }[];
}
