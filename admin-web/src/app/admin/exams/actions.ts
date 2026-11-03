"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ExamStatus } from "@/types/database.types";

export interface ExamSummaryItem {
  id: string;
  title: string;
  courseCode: string | null;
  description: string | null;
  passcode: string;
  durationMinutes: number;
  maxStrikes: number;
  status: ExamStatus;
  startTime: string;
  endTime: string;
  createdAt: string;
  enableNegativeMarking: boolean;
  totalQuestions: number;
  totalSections: number;
  targetDepartments: string[];
  calculatorMode: string;
}

export async function getExamsAction(): Promise<{
  exams: ExamSummaryItem[];
  error?: string;
}> {
  try {
    const { data: examsData, error: examsErr } = await supabaseAdmin
      .from("exams")
      .select(`
        id,
        title,
        course_code,
        description,
        passcode,
        duration_minutes,
        max_strikes,
        status,
        start_time,
        end_time,
        created_at,
        enable_negative_marking,
        config,
        sections:exam_sections(
          id,
          title,
          is_common,
          target_departments
        ),
        questions:exam_questions(
          id
        )
      `)
      .order("created_at", { ascending: false });

    if (examsErr) {
      console.error("Failed to fetch exams:", examsErr);
      return { exams: [], error: examsErr.message };
    }

    const formatted: ExamSummaryItem[] = (examsData || []).map((e: any) => {
      const config = e.config || {};
      const allDepts = new Set<string>();
      (e.sections || []).forEach((sec: any) => {
        if (sec.target_departments && Array.isArray(sec.target_departments)) {
          sec.target_departments.forEach((d: string) => {
            if (d?.trim()) allDepts.add(d.trim());
          });
        }
      });

      return {
        id: e.id,
        title: e.title,
        courseCode: e.course_code,
        description: e.description,
        passcode: e.passcode,
        durationMinutes: e.duration_minutes || 90,
        maxStrikes: e.max_strikes || 3,
        status: e.status as ExamStatus,
        startTime: e.start_time,
        endTime: e.end_time,
        createdAt: e.created_at,
        enableNegativeMarking: Boolean(e.enable_negative_marking),
        totalQuestions: (e.questions || []).length,
        totalSections: (e.sections || []).length,
        targetDepartments: Array.from(allDepts),
        calculatorMode: config.calculator_mode || "NONE",
      };
    });

    return { exams: formatted };
  } catch (err: any) {
    console.error("Unexpected error in getExamsAction:", err);
    return { exams: [], error: err.message };
  }
}

export async function deleteExamAction(examId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized access" };

    const { error } = await supabaseAdmin.from("exams").delete().eq("id", examId);

    if (error) {
      console.error("Failed to delete exam:", error);
      return { error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/exams");
    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in deleteExamAction:", err);
    return { error: err.message || "Failed to delete examination." };
  }
}

export async function updateExamStatusAction(
  examId: string,
  newStatus: ExamStatus
): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized access" };

    const { error } = await supabaseAdmin
      .from("exams")
      .update({ status: newStatus })
      .eq("id", examId);

    if (error) {
      console.error("Failed to update exam status:", error);
      return { error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/exams");
    revalidatePath(`/exams/${examId}`);
    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in updateExamStatusAction:", err);
    return { error: err.message || "Failed to update status." };
  }
}

export async function duplicateExamAction(examId: string): Promise<{
  success?: boolean;
  newExamId?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized access" };

    // 1. Fetch original exam
    const { data: original, error: origErr } = await supabaseAdmin
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();

    if (origErr || !original) {
      return { error: "Original examination not found." };
    }

    // 2. Fetch original sections
    const { data: origSections } = await supabaseAdmin
      .from("exam_sections")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    // 3. Fetch original questions with options
    const { data: origQuestions } = await supabaseAdmin
      .from("exam_questions")
      .select(`
        *,
        options:question_options(*)
      `)
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    // 4. Create cloned exam record (Status = DRAFT)
    const { data: newExam, error: createErr } = await supabaseAdmin
      .from("exams")
      .insert({
        title: `${original.title} (Copy)`,
        course_code: original.course_code,
        description: original.description,
        passcode: `COPY-${Math.floor(1000 + Math.random() * 9000)}`,
        duration_minutes: original.duration_minutes,
        start_time: original.start_time,
        end_time: original.end_time,
        max_strikes: original.max_strikes,
        randomize_questions: original.randomize_questions,
        enable_negative_marking: original.enable_negative_marking,
        config: original.config,
        status: "DRAFT",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createErr || !newExam) {
      return { error: createErr?.message || "Failed to duplicate examination." };
    }

    const newExamId = newExam.id;

    // 5. Clone sections
    const sectionMap = new Map<string, string>(); // oldSecId -> newSecId

    for (const sec of origSections || []) {
      const { data: newSec } = await supabaseAdmin
        .from("exam_sections")
        .insert({
          exam_id: newExamId,
          title: sec.title,
          description: sec.description,
          is_common: sec.is_common,
          target_departments: sec.target_departments,
          default_points: sec.default_points,
          default_negative_points: sec.default_negative_points,
          order_index: sec.order_index,
          config: sec.config,
        })
        .select("id")
        .single();

      if (newSec) {
        sectionMap.set(sec.id, newSec.id);
      }
    }

    // 6. Clone questions & options
    for (const q of origQuestions || []) {
      const targetSecId = q.section_id ? sectionMap.get(q.section_id) || null : null;

      const { data: newQ } = await supabaseAdmin
        .from("exam_questions")
        .insert({
          exam_id: newExamId,
          section_id: targetSecId,
          question_type: q.question_type,
          prompt: q.prompt,
          code_snippet: q.code_snippet,
          points: q.points,
          negative_points: q.negative_points,
          min_words: q.min_words,
          max_words: q.max_words,
          rubric_criteria: q.rubric_criteria,
          order_index: q.order_index,
        })
        .select("id")
        .single();

      if (newQ && q.options && q.options.length > 0) {
        const clonedOptions = q.options.map((opt: any) => ({
          question_id: newQ.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          order_index: opt.order_index,
        }));

        await supabaseAdmin.from("question_options").insert(clonedOptions);
      }
    }

    revalidatePath("/exams");
    return { success: true, newExamId };
  } catch (err: any) {
    console.error("Duplicate exam error:", err);
    return { error: err.message || "Failed to duplicate examination." };
  }
}

export interface ExamDetailsData {
  exam: any;
  sections: any[];
  questions: any[];
  candidates: Array<{
    id: string;
    applicationNumber: string;
    fullName: string;
    email: string;
    departmentCode: string;
    departmentName: string;
  }>;
}

export async function getExamDetailsWithRosterAction(examId: string): Promise<{
  data?: ExamDetailsData;
  error?: string;
}> {
  try {
    // 1. Fetch Exam
    const { data: exam, error: examErr } = await supabaseAdmin
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();

    if (examErr || !exam) {
      return { error: examErr?.message || "Exam not found" };
    }

    // 2. Fetch Sections
    const { data: sections } = await supabaseAdmin
      .from("exam_sections")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    // 3. Fetch Questions with options count
    const { data: questions } = await supabaseAdmin
      .from("exam_questions")
      .select(`
        id,
        section_id,
        question_type,
        prompt,
        points,
        negative_points,
        order_index,
        rubric_criteria,
        options:question_options(id)
      `)
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    // 4. Identify Target Departments
    const targetDeptCodes = new Set<string>();
    (sections || []).forEach((sec) => {
      if (sec.target_departments && Array.isArray(sec.target_departments)) {
        sec.target_departments.forEach((code: string) => {
          if (code?.trim()) targetDeptCodes.add(code.trim().toUpperCase());
        });
      }
    });

    // 5. Query eligible students
    let candidateQuery = supabaseAdmin
      .from("students")
      .select(`
        id,
        application_number,
        full_name,
        email,
        is_active,
        department:departments(
          code,
          name
        )
      `)
      .eq("is_active", true)
      .order("application_number", { ascending: true });

    const { data: studentsData } = await candidateQuery;

    // Filter candidates based on target departments (if target departments are specified)
    const filteredCandidates = (studentsData || [])
      .filter((s: any) => {
        if (targetDeptCodes.size === 0) return true; // Common to all
        const deptCode = s.department?.code?.toUpperCase();
        return deptCode && targetDeptCodes.has(deptCode);
      })
      .map((s: any) => ({
        id: s.id,
        applicationNumber: s.application_number || s.id.slice(0, 8).toUpperCase(),
        fullName: s.full_name,
        email: s.email,
        departmentCode: s.department?.code || "GEN",
        departmentName: s.department?.name || "General Discipline",
      }));

    return {
      data: {
        exam,
        sections: sections || [],
        questions: questions || [],
        candidates: filteredCandidates,
      },
    };
  } catch (err: any) {
    console.error("Failed to load exam details with roster:", err);
    return { error: err.message || "Failed to load examination details." };
  }
}

