"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface OptionInput {
  optionText: string;
  isCorrect: boolean;
}

export interface QuestionInput {
  departmentId?: string | null;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType: "MCQ_SINGLE" | "MCQ_MULTIPLE";
  prompt: string;
  codeSnippet?: string | null;
  defaultPoints: number;
  defaultNegativePoints: number;
  options: OptionInput[];
}

export async function createQuestionAction(data: QuestionInput) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    if (!data.prompt?.trim()) {
      return { error: "Question prompt is required." };
    }

    if (!data.options || data.options.length < 2) {
      return { error: "At least two options are required." };
    }

    const hasCorrect = data.options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      return { error: "At least one option must be marked as correct." };
    }

    // 1. Insert question (department_id is null for General / Common Core)
    const { data: question, error: qError } = await supabaseAdmin
      .from("department_questions")
      .insert({
        department_id: data.departmentId ? data.departmentId.trim() : null,
        topic: data.topic?.trim() || "General",
        difficulty: data.difficulty || "MEDIUM",
        question_type: data.questionType || "MCQ_SINGLE",
        prompt: data.prompt.trim(),
        code_snippet: data.codeSnippet?.trim() || null,
        default_points: data.defaultPoints || 1.0,
        default_negative_points: data.defaultNegativePoints || 0.0,
      })
      .select("id")
      .single();

    if (qError || !question) throw qError || new Error("Failed to create question");

    // 2. Insert options
    const optionsPayload = data.options.map((opt, idx) => ({
      question_id: question.id,
      option_text: opt.optionText.trim(),
      is_correct: opt.isCorrect,
      order_index: idx,
    }));

    const { error: optError } = await supabaseAdmin
      .from("department_question_options")
      .insert(optionsPayload);

    if (optError) throw optError;

    revalidatePath("/questions");
    revalidatePath("/departments");
    return { success: true, questionId: question.id };
  } catch (err: any) {
    return { error: err.message || "Failed to create question." };
  }
}

export async function updateQuestionAction(
  questionId: string,
  data: QuestionInput
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    if (!data.prompt?.trim()) {
      return { error: "Question prompt is required." };
    }

    if (!data.options || data.options.length < 2) {
      return { error: "At least two options are required." };
    }

    const hasCorrect = data.options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      return { error: "At least one option must be marked as correct." };
    }

    // 1. Update question
    const { error: qError } = await supabaseAdmin
      .from("department_questions")
      .update({
        department_id: data.departmentId ? data.departmentId.trim() : null,
        topic: data.topic?.trim() || "General",
        difficulty: data.difficulty || "MEDIUM",
        question_type: data.questionType || "MCQ_SINGLE",
        prompt: data.prompt.trim(),
        code_snippet: data.codeSnippet?.trim() || null,
        default_points: data.defaultPoints || 1.0,
        default_negative_points: data.defaultNegativePoints || 0.0,
      })
      .eq("id", questionId);

    if (qError) throw qError;

    // 2. Replace options
    await supabaseAdmin
      .from("department_question_options")
      .delete()
      .eq("question_id", questionId);

    const optionsPayload = data.options.map((opt, idx) => ({
      question_id: questionId,
      option_text: opt.optionText.trim(),
      is_correct: opt.isCorrect,
      order_index: idx,
    }));

    const { error: optError } = await supabaseAdmin
      .from("department_question_options")
      .insert(optionsPayload);

    if (optError) throw optError;

    revalidatePath("/questions");
    revalidatePath("/departments");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update question." };
  }
}

export async function deleteQuestionAction(questionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { error } = await supabaseAdmin
      .from("department_questions")
      .delete()
      .eq("id", questionId);

    if (error) throw error;

    revalidatePath("/questions");
    revalidatePath("/departments");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete question." };
  }
}

export interface BulkQuestionCsvRow {
  departmentCode?: string; // "GENERAL" or department code e.g. "MCA", "CSE"
  topic?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  questionType?: "MCQ_SINGLE" | "MCQ_MULTIPLE";
  prompt: string;
  codeSnippet?: string;
  optionA: string;
  optionB: string;
  optionC?: string;
  optionD?: string;
  correctAnswers: string; // e.g. "A" or "A,C"
  points?: number;
  negativePoints?: number;
}

export async function bulkImportQuestionsAction(rows: BulkQuestionCsvRow[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    if (!rows || rows.length === 0) {
      return { error: "No question records provided." };
    }

    // 1. Fetch all departments to map code -> UUID
    const { data: depts } = await supabaseAdmin.from("departments").select("id, code, name");
    const deptMap = new Map<string, string>();
    (depts || []).forEach((d) => deptMap.set(d.code.toUpperCase().trim(), d.id));

    // 2. Strict Pre-validation: verify all department codes exist or are explicitly GENERAL/COMMON
    for (let i = 0; i < rows.length; i++) {
      const rawDept = (rows[i].departmentCode || "").trim().toUpperCase();
      if (rawDept && rawDept !== "GENERAL" && rawDept !== "COMMON") {
        if (!deptMap.has(rawDept)) {
          return {
            error: `Unrecognized Department Code on row ${i + 1}: '${rawDept}'. Each question must either be designated 'GENERAL' or match a registered department code. Upload aborted to prevent misallocation.`,
          };
        }
      }
    }

    let importedCount = 0;

    for (const r of rows) {
      if (!r.prompt?.trim() || !r.optionA?.trim() || !r.optionB?.trim()) {
        continue;
      }

      const rawDept = (r.departmentCode || "").trim().toUpperCase();
      let targetDeptId: string | null = null;

      // Assign targetDeptId if specific department
      if (rawDept && rawDept !== "GENERAL" && rawDept !== "COMMON") {
        targetDeptId = deptMap.get(rawDept) || null;
      }

      const diff = ["EASY", "MEDIUM", "HARD"].includes((r.difficulty || "").toUpperCase())
        ? (r.difficulty!.toUpperCase() as "EASY" | "MEDIUM" | "HARD")
        : "MEDIUM";

      const qType = (r.questionType || "").toUpperCase() === "MCQ_MULTIPLE"
        ? "MCQ_MULTIPLE"
        : "MCQ_SINGLE";

      const { data: question, error: qError } = await supabaseAdmin
        .from("department_questions")
        .insert({
          department_id: targetDeptId,
          topic: r.topic?.trim() || "General",
          difficulty: diff,
          question_type: qType,
          prompt: r.prompt.trim(),
          code_snippet: r.codeSnippet?.trim() || null,
          default_points: Number(r.points) || 1.0,
          default_negative_points: Number(r.negativePoints) || 0.0,
        })
        .select("id")
        .single();

      if (qError || !question) continue;

      // Parse options
      const rawOptions = [
        { key: "A", text: r.optionA },
        { key: "B", text: r.optionB },
        { key: "C", text: r.optionC },
        { key: "D", text: r.optionD },
      ].filter((o) => o.text && o.text.trim().length > 0);

      const correctList = (r.correctAnswers || "A")
        .toUpperCase()
        .split(/[,\s]+/)
        .map((k) => k.trim());

      const optionsPayload = rawOptions.map((opt, idx) => ({
        question_id: question.id,
        option_text: opt.text!.trim(),
        is_correct: correctList.includes(opt.key),
        order_index: idx,
      }));

      // Ensure at least one option is correct
      if (!optionsPayload.some((o) => o.is_correct)) {
        optionsPayload[0].is_correct = true;
      }

      await supabaseAdmin
        .from("department_question_options")
        .insert(optionsPayload);

      importedCount++;
    }

    revalidatePath("/questions");
    revalidatePath("/departments");
    return { success: true, count: importedCount };
  } catch (err: any) {
    return { error: err.message || "Bulk question import failed." };
  }
}

