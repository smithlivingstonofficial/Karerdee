"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ExamGeneralState, SectionState, QuestionState, QuestionBankItem } from "./types";
import { Department } from "@/types/database.types";

export interface SaveExamPayload {
  examId?: string | null;
  exam: ExamGeneralState;
  sections: SectionState[];
  questions: QuestionState[];
  isDraft?: boolean;
}

export async function getExamAuthoringContextAction(): Promise<{
  departments: Department[];
  questionBank: QuestionBankItem[];
  error?: string;
}> {
  try {
    // 1. Fetch departments
    const { data: depts, error: deptsErr } = await supabaseAdmin
      .from("departments")
      .select("*")
      .order("code", { ascending: true });

    if (deptsErr) {
      console.error("Failed to fetch departments:", deptsErr);
      return { departments: [], questionBank: [], error: deptsErr.message };
    }

    // 2. Fetch question bank with options and department relation from department_questions
    const { data: questions, error: questionsErr } = await supabaseAdmin
      .from("department_questions")
      .select(`
        id,
        department_id,
        topic,
        difficulty,
        question_type,
        prompt,
        code_snippet,
        default_points,
        default_negative_points,
        created_at,
        department:departments (
          id,
          name,
          code
        ),
        options:department_question_options (
          id,
          option_text,
          is_correct,
          order_index
        )
      `)
      .order("created_at", { ascending: false });

    if (questionsErr) {
      console.error("Failed to fetch question bank:", questionsErr);
      return { departments: depts || [], questionBank: [], error: questionsErr.message };
    }

    // Type casting and normalization
    const formattedBank: QuestionBankItem[] = (questions || []).map((q: any) => {
      const deptObj = q.department
        ? Array.isArray(q.department)
          ? q.department[0]
          : q.department
        : null;

      return {
        id: q.id,
        department_id: q.department_id || null,
        department: deptObj
          ? {
              code: String(deptObj.code || "").toUpperCase(),
              name: String(deptObj.name || ""),
            }
          : null,
        topic: q.topic || "",
        question_type: q.question_type || "MCQ_SINGLE",
        prompt: q.prompt || "",
        code_snippet: q.code_snippet || null,
        points: Number(q.default_points ?? 1),
        negative_points: Number(q.default_negative_points ?? 0),
        difficulty: q.difficulty || "MEDIUM",
        options: (q.options || [])
          .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
          .map((opt: any) => ({
            id: opt.id,
            option_text: opt.option_text || "",
            is_correct: Boolean(opt.is_correct),
            order_index: opt.order_index || 1,
          })),
      };
    });

    return {
      departments: depts || [],
      questionBank: formattedBank,
    };
  } catch (err: any) {
    console.error("Unexpected error in getExamAuthoringContextAction:", err);
    return { departments: [], questionBank: [], error: err.message };
  }
}

export async function saveExamAction(payload: SaveExamPayload) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isDraft = Boolean(payload.isDraft);

    // 1. Validation Guardrails
    if (!isDraft) {
      // Strict validation for publishing
      if (!payload.exam.title?.trim()) {
        return { error: "Examination title is required to publish." };
      }
      if (!payload.exam.passcode?.trim()) {
        return { error: "Exam passcode is required to publish." };
      }
      if (payload.sections.length === 0) {
        return { error: "At least one section must be configured to publish." };
      }
      if (payload.questions.length === 0) {
        return { error: "At least one question must be added before publishing." };
      }

      // Validate that each question has valid prompt & correct answer
      for (let i = 0; i < payload.questions.length; i++) {
        const q = payload.questions[i];
        if (!q.prompt?.trim()) {
          return { error: `Question ${i + 1} has an empty prompt.` };
        }
        if (!q.options || q.options.length < 2) {
          return { error: `Question ${i + 1} must have at least 2 options.` };
        }
        const hasCorrect = q.options.some((opt) => opt.isCorrect);
        if (!hasCorrect) {
          return { error: `Question ${i + 1} does not have any correct answer selected.` };
        }
      }
    } else {
      // Draft validation: minimal requirement (title)
      if (!payload.exam.title?.trim()) {
        return { error: "Please enter an examination title to save as a draft." };
      }
    }

    // Prepare JSONB config for examination
    const examConfig = {
      instructions: payload.exam.instructions || "",
      late_entry_buffer_minutes: payload.exam.lateEntryBufferMinutes ?? 15,
      early_submission_min_percent: payload.exam.earlySubmissionMinPercent ?? 50,
      strike_action: payload.exam.strikeAction || "LOCK_WORKSTATION",
      calculator_mode: payload.exam.calculatorMode || "NONE",
      enable_scratchpad: Boolean(payload.exam.enableScratchpad),
      enable_question_flagging: Boolean(payload.exam.enableQuestionFlagging),
      randomize_options: Boolean(payload.exam.randomizeOptions),
      lockdown_policy: payload.exam.lockdownPolicy || {
        blockKeyboardHooks: true,
        blockDisplayAffinity: true,
        blockMultipleMonitors: true,
        blockVirtualMachines: true,
        blockBlacklistedProcesses: true,
        lockHardwareFingerprint: false,
      },
    };

    let examId = payload.examId || null;
    const examStatus = isDraft ? "DRAFT" : "SCHEDULED";
    const resolvedPasscode = payload.exam.passcode?.trim() || "DRAFT";
    const resolvedStartTime = payload.exam.startTime
      ? new Date(payload.exam.startTime).toISOString()
      : new Date().toISOString();
    const resolvedEndTime = payload.exam.endTime
      ? new Date(payload.exam.endTime).toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    if (examId) {
      // 2a. Update existing exam metadata
      const { error: updateError } = await supabaseAdmin
        .from("exams")
        .update({
          title: payload.exam.title.trim(),
          course_code: payload.exam.courseCode?.trim() || null,
          description: payload.exam.description?.trim() || null,
          passcode: resolvedPasscode,
          duration_minutes: payload.exam.durationMinutes || 90,
          start_time: resolvedStartTime,
          end_time: resolvedEndTime,
          max_strikes: payload.exam.maxStrikes || 3,
          randomize_questions: payload.exam.randomizeQuestions,
          enable_negative_marking: payload.exam.enableNegativeMarking,
          config: examConfig,
          status: examStatus,
        })
        .eq("id", examId);

      if (updateError) {
        console.error("Exam update error:", updateError);
        return { error: updateError.message || "Failed to update draft record." };
      }

      // 2b. Clean up old questions, options, submissions, and sections cleanly
      const { data: existingQs, error: fetchQErr } = await supabaseAdmin
        .from("exam_questions")
        .select("id")
        .eq("exam_id", examId);

      if (fetchQErr) {
        console.error("Fetch existing questions error:", fetchQErr);
        return { error: `Failed to inspect exam questions: ${fetchQErr.message}` };
      }

      const existingQIds = (existingQs || []).map((q) => q.id);

      if (existingQIds.length > 0) {
        // Remove submissions referencing these questions to prevent RESTRICT foreign key blocks
        const { error: subErr } = await supabaseAdmin
          .from("submissions")
          .delete()
          .in("question_id", existingQIds);
        if (subErr) {
          console.error("Submissions cleanup error:", subErr);
        }

        // Delete question options
        const { error: optErr } = await supabaseAdmin
          .from("question_options")
          .delete()
          .in("question_id", existingQIds);
        if (optErr) {
          console.error("Options cleanup error:", optErr);
        }

        // Delete questions
        const { error: qErr } = await supabaseAdmin
          .from("exam_questions")
          .delete()
          .eq("exam_id", examId);
        if (qErr) {
          console.error("Questions cleanup error:", qErr);
          return { error: `Failed to remove old exam questions: ${qErr.message}` };
        }
      }

      // Delete old sections
      const { error: secDelErr } = await supabaseAdmin
        .from("exam_sections")
        .delete()
        .eq("exam_id", examId);

      if (secDelErr) {
        console.error("Sections cleanup error:", secDelErr);
        return { error: `Failed to remove old exam sections: ${secDelErr.message}` };
      }
    } else {
      // 2c. Insert brand new exam
      const { data: newExam, error: examError } = await supabaseAdmin
        .from("exams")
        .insert({
          title: payload.exam.title.trim(),
          course_code: payload.exam.courseCode?.trim() || null,
          description: payload.exam.description?.trim() || null,
          passcode: resolvedPasscode,
          duration_minutes: payload.exam.durationMinutes || 90,
          start_time: resolvedStartTime,
          end_time: resolvedEndTime,
          max_strikes: payload.exam.maxStrikes || 3,
          randomize_questions: payload.exam.randomizeQuestions,
          enable_negative_marking: payload.exam.enableNegativeMarking,
          config: examConfig,
          status: examStatus,
          created_by: user?.id || null,
        })
        .select("id")
        .single();

      if (examError || !newExam) {
        console.error("Exam save error:", examError);
        return { error: examError?.message || "Failed to create examination record." };
      }

      examId = newExam.id;
    }

    // 3. Map & Insert Sections
    const sectionIdMap = new Map<string, string>(); // client tempId -> db UUID
    const savedSections: SectionState[] = [];

    for (const sec of payload.sections) {
      const sectionConfig = {
        navigation_mode: sec.navigationMode || "FLEXIBLE",
        time_limit_minutes: sec.timeLimitMinutes || null,
        target_question_count: sec.targetQuestionCount || 25,
      };

      const { data: dbSec, error: secError } = await supabaseAdmin
        .from("exam_sections")
        .insert({
          exam_id: examId,
          title: sec.title.trim() || "Untitled Section",
          is_common: sec.isCommon,
          target_departments: sec.targetDepartments || [],
          default_points: sec.defaultPoints || 1,
          default_negative_points: payload.exam.enableNegativeMarking ? sec.defaultNegativePoints : 0,
          order_index: sec.orderIndex || 1,
          config: sectionConfig,
        })
        .select("*")
        .single();

      if (secError || !dbSec) {
        console.error("Section save error:", secError);
        return { error: `Failed to create section "${sec.title}": ${secError?.message}` };
      }

      sectionIdMap.set(sec.id, dbSec.id);
      savedSections.push({
        id: dbSec.id,
        title: dbSec.title,
        isCommon: dbSec.is_common,
        targetDepartments: dbSec.target_departments || [],
        defaultPoints: Number(dbSec.default_points ?? 1),
        defaultNegativePoints: Number(dbSec.default_negative_points ?? 0),
        orderIndex: dbSec.order_index,
        navigationMode: sectionConfig.navigation_mode,
        timeLimitMinutes: sectionConfig.time_limit_minutes,
        targetQuestionCount: sectionConfig.target_question_count,
      });
    }

    // 4. Map & Insert Questions & Options with strict quota enforcement & prompt deduplication
    // Build quota limits per section and department track
    const sectionQuotaMap = new Map<string, number>();
    const sectionIsCommonMap = new Map<string, boolean>();

    for (const sec of payload.sections) {
      const dbSecId = sectionIdMap.get(sec.id);
      if (!dbSecId) continue;
      sectionQuotaMap.set(dbSecId, sec.targetQuestionCount || 20);
      sectionIsCommonMap.set(dbSecId, sec.isCommon);
    }

    const sectionTrackCounts = new Map<string, number>();
    const seenSectionPrompts = new Set<string>();
    const questionsToSave: Array<{
      q: QuestionState;
      resolvedSectionId: string;
      orderIndex: number;
    }> = [];

    const rawCandidateQuestions = isDraft
      ? payload.questions.filter((q) => q.prompt?.trim())
      : payload.questions;

    for (const q of rawCandidateQuestions) {
      const resolvedSectionId =
        sectionIdMap.get(q.sectionId) || (savedSections[0] ? savedSections[0].id : "");
      if (!resolvedSectionId) continue;

      const isCommon = sectionIsCommonMap.get(resolvedSectionId) ?? true;
      const quotaLimit = sectionQuotaMap.get(resolvedSectionId) || 20;

      // Track key: for common section, key is resolvedSectionId.
      // For elective section, key is resolvedSectionId + deptCode.
      const deptCode = q.targetDepartment ? q.targetDepartment.trim().toUpperCase() : "";
      const trackKey = isCommon ? resolvedSectionId : `${resolvedSectionId}_${deptCode}`;

      // Deduplicate identical prompts within the same section/track
      const promptDedupeKey = `${trackKey}_${q.prompt.trim().toLowerCase()}`;
      if (seenSectionPrompts.has(promptDedupeKey)) {
        continue;
      }

      const currentCount = sectionTrackCounts.get(trackKey) || 0;
      if (currentCount >= quotaLimit) {
        // Enforce strict quota limit! Never exceed the section's set limit.
        continue;
      }

      seenSectionPrompts.add(promptDedupeKey);
      sectionTrackCounts.set(trackKey, currentCount + 1);
      questionsToSave.push({
        q,
        resolvedSectionId,
        orderIndex: currentCount + 1,
      });
    }

    const savedQuestions: QuestionState[] = [];

    for (const { q, resolvedSectionId, orderIndex } of questionsToSave) {
      const { data: dbQ, error: qError } = await supabaseAdmin
        .from("exam_questions")
        .insert({
          exam_id: examId,
          section_id: resolvedSectionId,
          question_type: q.questionType || "MCQ_SINGLE",
          prompt: q.prompt.trim(),
          code_snippet: q.codeSnippet?.trim() || null,
          points: q.points || 1,
          negative_points: payload.exam.enableNegativeMarking ? q.negativePoints : 0,
          rubric_criteria: sectionIsCommonMap.get(resolvedSectionId)
            ? null
            : q.targetDepartment
            ? { target_department: q.targetDepartment }
            : null,
          order_index: orderIndex,
        })
        .select("*")
        .single();

      if (qError || !dbQ) {
        console.error("Question save error:", qError);
        return { error: `Failed to save question: ${q.prompt.slice(0, 30)}...` };
      }

      const savedOptions: any[] = [];

      // Insert Options
      if (q.options && q.options.length > 0) {
        const optionsToInsert = q.options.map((opt, optIdx) => ({
          question_id: dbQ.id,
          option_text: opt.text?.trim() || `Option ${optIdx + 1}`,
          is_correct: Boolean(opt.isCorrect),
          order_index: opt.orderIndex || optIdx + 1,
        }));

        const { data: dbOptions, error: optError } = await supabaseAdmin
          .from("question_options")
          .insert(optionsToInsert)
          .select("*");

        if (optError) {
          console.error("Option save error:", optError);
          return { error: "Failed to save options for question." };
        }

        (dbOptions || []).forEach((opt: any) => {
          savedOptions.push({
            id: opt.id,
            text: opt.option_text,
            isCorrect: opt.is_correct,
            orderIndex: opt.order_index,
          });
        });
      }

      savedQuestions.push({
        id: dbQ.id,
        sectionId: resolvedSectionId,
        questionType: dbQ.question_type,
        prompt: dbQ.prompt,
        codeSnippet: dbQ.code_snippet,
        points: Number(dbQ.points ?? 1),
        negativePoints: Number(dbQ.negative_points ?? 0),
        orderIndex: dbQ.order_index,
        targetDepartment: q.targetDepartment,
        options: savedOptions,
      });
    }

    revalidatePath("/");
    revalidatePath("/exams");
    revalidatePath(`/exams/${examId}`);
    revalidatePath(`/exams/new`);
    return {
      success: true,
      examId,
      isDraft,
      sections: savedSections,
      questions: savedQuestions,
    };
  } catch (err: any) {
    console.error("Unexpected Save Exam Error:", err);
    return { error: err.message || "An unexpected error occurred while saving the examination." };
  }
}

export async function getExamForEditingAction(examId: string): Promise<{
  exam?: ExamGeneralState;
  sections?: SectionState[];
  questions?: QuestionState[];
  status?: string;
  error?: string;
}> {
  try {
    // 1. Fetch exam
    const { data: exam, error: examErr } = await supabaseAdmin
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();

    if (examErr || !exam) {
      return { error: examErr?.message || "Exam not found" };
    }

    // 2. Fetch sections
    const { data: dbSections, error: secErr } = await supabaseAdmin
      .from("exam_sections")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    if (secErr) {
      return { error: secErr.message };
    }

    // 3. Fetch questions with options
    const { data: dbQuestions, error: qErr } = await supabaseAdmin
      .from("exam_questions")
      .select(`
        id,
        section_id,
        question_type,
        prompt,
        code_snippet,
        points,
        negative_points,
        order_index,
        rubric_criteria,
        options:question_options(
          id,
          option_text,
          is_correct,
          order_index
        )
      `)
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    if (qErr) {
      return { error: qErr.message };
    }

    // Reconstruct ExamGeneralState
    const config = (exam.config as any) || {};
    const examGeneral: ExamGeneralState = {
      title: exam.title || "",
      courseCode: exam.course_code || "",
      description: exam.description || "",
      instructions: exam.instructions || config.instructions || "",
      passcode: exam.passcode === "DRAFT" ? "" : exam.passcode || "",
      durationMinutes: exam.duration_minutes || 90,
      startTime: exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : "",
      endTime: exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : "",
      maxStrikes: exam.max_strikes || 3,
      randomizeQuestions: exam.randomize_questions ?? true,
      randomizeOptions: config.randomize_options ?? true,
      enableNegativeMarking: exam.enable_negative_marking ?? false,
      lateEntryBufferMinutes: config.late_entry_buffer_minutes ?? 15,
      earlySubmissionMinPercent: config.early_submission_min_percent ?? 50,
      strikeAction: config.strike_action || "LOCK_WORKSTATION",
      calculatorMode: config.calculator_mode || "NONE",
      enableScratchpad: config.enable_scratchpad ?? true,
      enableQuestionFlagging: config.enable_question_flagging ?? true,
      lockdownPolicy: config.lockdown_policy || {
        blockKeyboardHooks: true,
        blockDisplayAffinity: true,
        blockMultipleMonitors: true,
        blockVirtualMachines: true,
        blockBlacklistedProcesses: true,
        lockHardwareFingerprint: false,
      },
    };

    // Reconstruct SectionState[]
    const sections: SectionState[] = (dbSections || []).map((sec: any) => ({
      id: sec.id,
      title: sec.title,
      isCommon: sec.is_common,
      targetDepartments: sec.target_departments || [],
      defaultPoints: Number(sec.default_points) || 1,
      defaultNegativePoints: Number(sec.default_negative_points) || 0,
      orderIndex: sec.order_index,
      navigationMode: sec.config?.navigation_mode || "FLEXIBLE",
      timeLimitMinutes: sec.config?.time_limit_minutes || null,
      targetQuestionCount: sec.config?.target_question_count || 25,
    }));

    // Reconstruct QuestionState[] with strict quota enforcement and prompt deduplication
    const secQuotaMap = new Map<string, number>();
    const secCommonMap = new Map<string, boolean>();
    sections.forEach((s) => {
      secQuotaMap.set(s.id, s.targetQuestionCount || 20);
      secCommonMap.set(s.id, s.isCommon);
    });

    const editTrackCounts = new Map<string, number>();
    const editSeenPrompts = new Set<string>();
    const questions: QuestionState[] = [];

    for (const q of dbQuestions || []) {
      const isCommon = secCommonMap.get(q.section_id) ?? true;
      const quota = secQuotaMap.get(q.section_id) || 20;
      const deptCode = q.rubric_criteria?.target_department
        ? String(q.rubric_criteria.target_department).trim().toUpperCase()
        : "";
      const trackKey = isCommon ? q.section_id : `${q.section_id}_${deptCode}`;
      const promptDedupeKey = `${trackKey}_${String(q.prompt || "").trim().toLowerCase()}`;

      if (editSeenPrompts.has(promptDedupeKey)) {
        continue;
      }

      const count = editTrackCounts.get(trackKey) || 0;
      if (count >= quota) {
        continue;
      }

      editSeenPrompts.add(promptDedupeKey);
      editTrackCounts.set(trackKey, count + 1);

      questions.push({
        id: q.id,
        sectionId: q.section_id,
        targetDepartment: q.rubric_criteria?.target_department || null,
        questionType: q.question_type,
        prompt: q.prompt,
        codeSnippet: q.code_snippet || undefined,
        points: Number(q.points) || 1,
        negativePoints: Number(q.negative_points) || 0,
        orderIndex: count + 1,
        options: (q.options || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((opt: any) => ({
            id: opt.id,
            text: opt.option_text,
            isCorrect: opt.is_correct,
            orderIndex: opt.order_index,
          })),
      });
    }

    return {
      exam: examGeneral,
      sections: sections.length > 0 ? sections : undefined,
      questions,
      status: exam.status,
    };
  } catch (err: any) {
    console.error("Failed to load exam for editing:", err);
    return { error: err.message || "Failed to load examination." };
  }
}
