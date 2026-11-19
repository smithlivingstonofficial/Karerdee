"use server";

import fs from "fs";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ExamGeneralState, SectionState, QuestionState, QuestionBankItem } from "./types";
import { Department } from "@/types/database.types";
import { parseISTDateTime, formatToISTDateTimeLocal } from "@/lib/date";
import { sanitizeCodeSnippet, isBogusDepartmentSnippet } from "@/lib/snippets";

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

      const codeStr = String(deptObj?.code || "").toUpperCase();
      const topicStr = String(q.topic || "").toLowerCase();
      const promptStr = String(q.prompt || "");
      const isTamil =
        codeStr === "TAM" ||
        codeStr === "TAMIL" ||
        topicStr.includes("tamil") ||
        topicStr.includes("தமிழ்") ||
        /[\u0B80-\u0BFF]/.test(promptStr);

      return {
        id: q.id,
        department_id: q.department_id || null,
        department: deptObj
          ? {
              code: codeStr,
              name: String(deptObj.name || ""),
            }
          : null,
        topic: q.topic || "",
        language: isTamil ? "TA" : "EN",
        question_type: q.question_type || "MCQ_SINGLE",
        prompt: q.prompt || "",
        code_snippet: sanitizeCodeSnippet(q.code_snippet, codeStr) || null,
        points: 1, // Standardized 1 mark
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
      ? parseISTDateTime(payload.exam.startTime).toISOString()
      : new Date().toISOString();
    const resolvedEndTime = payload.exam.endTime
      ? parseISTDateTime(payload.exam.endTime).toISOString()
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
          default_points: 1, // Standardized 1 mark
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
    const sectionTargetDeptsMap = new Map<string, string[]>();

    for (const sec of payload.sections) {
      const dbSecId = sectionIdMap.get(sec.id);
      if (!dbSecId) continue;
      sectionQuotaMap.set(dbSecId, sec.targetQuestionCount || 25);
      sectionIsCommonMap.set(dbSecId, sec.isCommon);
      sectionTargetDeptsMap.set(
        dbSecId,
        (sec.targetDepartments || []).map((d) => d.trim().toUpperCase())
      );
    }

    const rawCandidateQuestions = isDraft
      ? payload.questions.filter((q) => q.prompt?.trim())
      : payload.questions;

    // =========================================================================
    // SECURITY INTEGRITY CHECK: Cross-Department Track Isolation Verification
    // Prevent importing or saving questions from other departments into mismatched tracks.
    // =========================================================================
    const sourceQuestionIds = rawCandidateQuestions
      .map((q) => q.sourceQuestionId)
      .filter((id): id is string => Boolean(id));

    const sourceQuestionMap = new Map<string, any>();
    if (sourceQuestionIds.length > 0) {
      const { data: dbSourceQuestions, error: sourceErr } = await supabaseAdmin
        .from("department_questions")
        .select(`
          id,
          department_id,
          prompt,
          department:departments (
            id,
            code,
            name
          )
        `)
        .in("id", sourceQuestionIds);

      if (sourceErr) {
        console.warn("Failed to verify source question bank origins:", sourceErr);
      } else if (dbSourceQuestions) {
        dbSourceQuestions.forEach((sq: any) => {
          sourceQuestionMap.set(sq.id, sq);
        });
      }
    }

    // Validate every candidate question against section and true department origin
    for (const q of rawCandidateQuestions) {
      const resolvedSectionId =
        sectionIdMap.get(q.sectionId) || (savedSections[0] ? savedSections[0].id : "");
      if (!resolvedSectionId) continue;

      const isCommon = sectionIsCommonMap.get(resolvedSectionId) ?? true;
      const allowedDepts = sectionTargetDeptsMap.get(resolvedSectionId) || [];
      const targetDept = q.targetDepartment ? q.targetDepartment.trim().toUpperCase() : "";

      if (!isCommon) {
        if (!targetDept) {
          return {
            error: `Validation Error: Question "${q.prompt.slice(0, 40)}..." is placed in a department specialization section but is missing a department track assignment.`,
          };
        }
        if (allowedDepts.length > 0 && !allowedDepts.includes(targetDept)) {
          return {
            error: `Security Error: Department track "${targetDept}" is not authorized for this section. Permitted department tracks: ${allowedDepts.join(", ")}.`,
          };
        }
      }

      // Check origin from Question Bank
      if (q.sourceQuestionId) {
        const srcRecord = sourceQuestionMap.get(q.sourceQuestionId);
        if (srcRecord) {
          const deptObj = Array.isArray(srcRecord.department)
            ? srcRecord.department[0]
            : srcRecord.department;
          const trueSourceCode = deptObj?.code ? deptObj.code.trim().toUpperCase() : "GENERAL";

          if (!isCommon && targetDept && trueSourceCode !== "GENERAL" && trueSourceCode !== targetDept) {
            return {
              error: `Academic Integrity Security Violation: Question "${q.prompt.slice(0, 45)}..." originates from the ${trueSourceCode} (${deptObj?.name || trueSourceCode}) repository, but was assigned to the ${targetDept} track. Cross-department track contamination is strictly prohibited.`,
            };
          }
        }
      }
    }

    const sectionTrackCounts = new Map<string, number>();
    const seenSectionPrompts = new Set<string>();
    const questionsToSave: Array<{
      q: QuestionState;
      resolvedSectionId: string;
      orderIndex: number;
    }> = [];

    for (const q of rawCandidateQuestions) {
      const resolvedSectionId =
        sectionIdMap.get(q.sectionId) || (savedSections[0] ? savedSections[0].id : "");
      if (!resolvedSectionId) continue;

      const isCommon = sectionIsCommonMap.get(resolvedSectionId) ?? true;
      const quotaLimit = sectionQuotaMap.get(resolvedSectionId) || 25;

      // Track key: for common section, key distinguishes between English and Tamil Common Core!
      // For elective section, key is resolvedSectionId + deptCode.
      const deptCode = q.targetDepartment ? q.targetDepartment.trim().toUpperCase() : "";
      const isTamilCommon =
        q.commonLanguage === "TA" ||
        deptCode === "TAM" ||
        deptCode === "TAMIL" ||
        /[\u0B80-\u0BFF]/.test(q.prompt || "");

      const langCode = isTamilCommon ? "TA" : "EN";
      const trackKey = isCommon ? `${resolvedSectionId}_${langCode}` : `${resolvedSectionId}_${deptCode}`;

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

    if (questionsToSave.length > 0) {
      // 1. High-Performance Atomic Batch Insert for All Questions with verified department audit metadata
      const questionsInsertPayload = questionsToSave.map(({ q, resolvedSectionId, orderIndex }) => {
        const cleanDept = q.targetDepartment ? q.targetDepartment.trim().toUpperCase() : null;
        const isCommonSec = sectionIsCommonMap.get(resolvedSectionId);
        const isTamil =
          q.commonLanguage === "TA" ||
          cleanDept === "TAM" ||
          cleanDept === "TAMIL" ||
          /[\u0B80-\u0BFF]/.test(q.prompt || "");

        return {
          exam_id: examId,
          section_id: resolvedSectionId,
          question_type: q.questionType || "MCQ_SINGLE",
          prompt: q.prompt.trim(),
          code_snippet: sanitizeCodeSnippet(q.codeSnippet, cleanDept) || null,
          points: 1, // Standardized 1 mark
          negative_points: payload.exam.enableNegativeMarking ? q.negativePoints : 0,
          rubric_criteria: isCommonSec
            ? {
                common_language: isTamil ? "TA" : "EN",
                target_department: null,
              }
            : cleanDept
            ? {
                target_department: cleanDept,
                source_question_id: q.sourceQuestionId || null,
                source_department: cleanDept,
                verified_track: true,
              }
            : null,
          order_index: orderIndex,
        };
      });

      const { data: insertedDbQuestions, error: qBatchError } = await supabaseAdmin
        .from("exam_questions")
        .insert(questionsInsertPayload)
        .select("id, exam_id, section_id, question_type, prompt, code_snippet, points, negative_points, order_index, rubric_criteria");

      if (qBatchError || !insertedDbQuestions || insertedDbQuestions.length === 0) {
        console.error("Batch question save error:", qBatchError);
        return { error: `Failed to save examination questions: ${qBatchError?.message || "Unknown error"}` };
      }

      // 2. High-Performance Atomic Batch Insert for All Question Options
      const optionsToInsert: any[] = [];
      for (let i = 0; i < questionsToSave.length; i++) {
        const dbQ = insertedDbQuestions[i];
        const { q } = questionsToSave[i];
        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, optIdx) => {
            optionsToInsert.push({
              question_id: dbQ.id,
              option_text: opt.text?.trim() || `Option ${optIdx + 1}`,
              is_correct: Boolean(opt.isCorrect),
              order_index: opt.orderIndex || optIdx + 1,
            });
          });
        }
      }

      const insertedOptionsMap = new Map<string, any[]>();
      if (optionsToInsert.length > 0) {
        const { data: dbOptions, error: optBatchError } = await supabaseAdmin
          .from("question_options")
          .insert(optionsToInsert)
          .select("id, question_id, option_text, is_correct, order_index");

        if (optBatchError) {
          console.error("Batch option save error:", optBatchError);
          return { error: `Failed to save question options: ${optBatchError?.message || "Unknown error"}` };
        }

        (dbOptions || []).forEach((opt: any) => {
          const list = insertedOptionsMap.get(opt.question_id) || [];
          list.push({
            id: opt.id,
            text: opt.option_text,
            isCorrect: opt.is_correct,
            orderIndex: opt.order_index,
          });
          insertedOptionsMap.set(opt.question_id, list);
        });
      }

      for (let i = 0; i < questionsToSave.length; i++) {
        const dbQ = insertedDbQuestions[i];
        const { q, resolvedSectionId } = questionsToSave[i];
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
          options: insertedOptionsMap.get(dbQ.id) || [],
        });
      }
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
      startTime: exam.start_time ? formatToISTDateTimeLocal(exam.start_time) : "",
      endTime: exam.end_time ? formatToISTDateTimeLocal(exam.end_time) : "",
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
      const quota = secQuotaMap.get(q.section_id) || 25;
      const deptCode = q.rubric_criteria?.target_department
        ? String(q.rubric_criteria.target_department).trim().toUpperCase()
        : "";

      const isTamil =
        q.rubric_criteria?.common_language === "TA" ||
        deptCode === "TAM" ||
        deptCode === "TAMIL" ||
        /[\u0B80-\u0BFF]/.test(q.prompt || "");

      const langCode = isTamil ? "TA" : "EN";
      const trackKey = isCommon ? `${q.section_id}_${langCode}` : `${q.section_id}_${deptCode}`;
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
        commonLanguage: isCommon ? langCode : undefined,
        questionType: q.question_type,
        prompt: q.prompt,
        codeSnippet: sanitizeCodeSnippet(q.code_snippet, deptCode),
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

export interface BulkImportDeptQuestionsPayload {
  sectionId: string;
  departmentCodes: string[];
  targetQuota?: number;
  defaultNegativePoints?: number;
  existingQuestions?: Array<{
    prompt: string;
    targetDepartment?: string | null;
    sourceQuestionId?: string;
  }>;
}

export interface BulkImportDeptQuestionsResult {
  success: boolean;
  error?: string;
  newQuestions: QuestionState[];
  stats: {
    totalImported: number;
    departmentsFulfilled: string[];
    departmentCounts: Record<string, number>;
    departmentsCount: number;
  };
}

function parseCsvLineHelper(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function findDepartmentCsvDir(): string | null {
  const primary = path.join(process.cwd(), ".data", "questions", "csv");
  if (fs.existsSync(primary)) return primary;
  const parent = path.join(process.cwd(), "..", ".data", "questions", "csv");
  if (fs.existsSync(parent)) return parent;
  return null;
}

export async function bulkImportAllDepartmentQuestionsAction(
  payload: BulkImportDeptQuestionsPayload
): Promise<BulkImportDeptQuestionsResult> {
  try {
    const {
      sectionId,
      departmentCodes = [],
      targetQuota = 25,
      defaultNegativePoints = 0.25,
      existingQuestions = [],
    } = payload;

    if (!sectionId) {
      return {
        success: false,
        error: "Missing sectionId for bulk import.",
        newQuestions: [],
        stats: { totalImported: 0, departmentsFulfilled: [], departmentCounts: {}, departmentsCount: 0 },
      };
    }

    if (departmentCodes.length === 0) {
      return {
        success: false,
        error: "No target departments specified.",
        newQuestions: [],
        stats: { totalImported: 0, departmentsFulfilled: [], departmentCounts: {}, departmentsCount: 0 },
      };
    }

    // Set of existing prompts for deduplication
    const existingPromptsSet = new Set<string>();
    const existingDeptCounts: Record<string, number> = {};

    existingQuestions.forEach((q) => {
      const code = (q.targetDepartment || "").trim().toUpperCase();
      if (code) {
        existingDeptCounts[code] = (existingDeptCounts[code] || 0) + 1;
        existingPromptsSet.add(`${code}_${q.prompt.trim().toLowerCase()}`);
      }
    });

    const newQuestions: QuestionState[] = [];
    const departmentCounts: Record<string, number> = {};
    const departmentsFulfilled: string[] = [];
    const csvDir = findDepartmentCsvDir();

    // Fetch department questions from Supabase for all departments in bulk
    const { data: dbBankQuestions } = await supabaseAdmin
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
        department:departments (
          code
        ),
        options:department_question_options (
          id,
          option_text,
          is_correct,
          order_index
        )
      `);

    // Group db bank questions by department code
    const dbBankByDept = new Map<string, any[]>();
    (dbBankQuestions || []).forEach((q: any) => {
      const deptObj = q.department ? (Array.isArray(q.department) ? q.department[0] : q.department) : null;
      const dCode = (deptObj?.code || "").trim().toUpperCase();
      if (dCode) {
        if (!dbBankByDept.has(dCode)) dbBankByDept.set(dCode, []);
        dbBankByDept.get(dCode)!.push(q);
      }
    });

    for (const rawCode of departmentCodes) {
      const deptCode = rawCode.trim().toUpperCase();
      const currentCount = existingDeptCounts[deptCode] || 0;
      const needed = Math.max(0, targetQuota - currentCount);

      if (needed <= 0) {
        departmentsFulfilled.push(deptCode);
        departmentCounts[deptCode] = 0;
        continue;
      }

      let addedForThisDept = 0;

      // 1. Try DB question bank first
      const bankItems = dbBankByDept.get(deptCode) || [];
      for (const bq of bankItems) {
        if (addedForThisDept >= needed) break;
        const promptKey = `${deptCode}_${String(bq.prompt || "").trim().toLowerCase()}`;
        if (existingPromptsSet.has(promptKey)) continue;

        const qId = `q-bulk-${deptCode.toLowerCase()}-${Date.now()}-${addedForThisDept}-${Math.random().toString(36).slice(2, 6)}`;
        newQuestions.push({
          id: qId,
          sectionId,
          targetDepartment: deptCode,
          questionType: bq.question_type || "MCQ_SINGLE",
          prompt: bq.prompt,
          codeSnippet: sanitizeCodeSnippet(bq.code_snippet, deptCode),
          points: 1.0,
          negativePoints: defaultNegativePoints,
          orderIndex: currentCount + addedForThisDept + 1,
          sourceQuestionId: bq.id,
          sourceDepartment: deptCode,
          options: (bq.options || []).map((opt: any, oIdx: number) => ({
            id: `opt-b-${Date.now()}-${addedForThisDept}-${oIdx}`,
            text: opt.option_text,
            isCorrect: opt.is_correct,
            orderIndex: opt.order_index ?? (oIdx + 1),
          })),
        });

        existingPromptsSet.add(promptKey);
        addedForThisDept++;
      }

      // 2. If still needed, load from local CSV files (.data/questions/csv/${deptCode}.csv)
      if (addedForThisDept < needed && csvDir) {
        const csvPath = path.join(csvDir, `${deptCode}.csv`);
        if (fs.existsSync(csvPath)) {
          try {
            const content = fs.readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, "");
            const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

            for (let rowIdx = 1; rowIdx < lines.length && addedForThisDept < needed; rowIdx++) {
              const line = lines[rowIdx].trim();
              if (!line) continue;
              const cols = parseCsvLineHelper(line);
              if (cols.length < 7) continue;

              const prompt = (cols[1] || "").trim();
              if (!prompt) continue;

              const promptKey = `${deptCode}_${prompt.toLowerCase()}`;
              if (existingPromptsSet.has(promptKey)) continue;

              const optA = (cols[2] || "").trim();
              const optB = (cols[3] || "").trim();
              const optC = (cols[4] || "").trim();
              const optD = (cols[5] || "").trim();
              const correctRaw = (cols[6] || "").trim().toUpperCase();
              const correctLetters = correctRaw.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
              const isMulti = correctLetters.length > 1;

              const options = [
                { id: `opt-c-${deptCode}-${rowIdx}-1`, text: optA, isCorrect: correctLetters.includes("A") || correctLetters.includes("1"), orderIndex: 1 },
                { id: `opt-c-${deptCode}-${rowIdx}-2`, text: optB, isCorrect: correctLetters.includes("B") || correctLetters.includes("2"), orderIndex: 2 },
                { id: `opt-c-${deptCode}-${rowIdx}-3`, text: optC, isCorrect: correctLetters.includes("C") || correctLetters.includes("3"), orderIndex: 3 },
                { id: `opt-c-${deptCode}-${rowIdx}-4`, text: optD, isCorrect: correctLetters.includes("D") || correctLetters.includes("4"), orderIndex: 4 },
              ];

              if (!options.some((o) => o.isCorrect)) {
                options[0].isCorrect = true;
              }

              const qId = `q-csv-${deptCode.toLowerCase()}-${Date.now()}-${rowIdx}-${Math.random().toString(36).slice(2, 6)}`;
              newQuestions.push({
                id: qId,
                sectionId,
                targetDepartment: deptCode,
                questionType: isMulti ? "MCQ_MULTIPLE" : "MCQ_SINGLE",
                prompt,
                points: 1.0,
                negativePoints: defaultNegativePoints,
                orderIndex: currentCount + addedForThisDept + 1,
                sourceDepartment: deptCode,
                options,
              });

              existingPromptsSet.add(promptKey);
              addedForThisDept++;
            }
          } catch (fileErr) {
            console.error(`Error reading CSV for dept ${deptCode}:`, fileErr);
          }
        }
      }

      departmentCounts[deptCode] = addedForThisDept;
      if (currentCount + addedForThisDept >= targetQuota) {
        departmentsFulfilled.push(deptCode);
      }
    }

    return {
      success: true,
      newQuestions,
      stats: {
        totalImported: newQuestions.length,
        departmentsFulfilled,
        departmentCounts,
        departmentsCount: departmentCodes.length,
      },
    };
  } catch (err: any) {
    console.error("bulkImportAllDepartmentQuestionsAction exception:", err);
    return {
      success: false,
      error: err.message || "Failed to bulk import department questions.",
      newQuestions: [],
      stats: { totalImported: 0, departmentsFulfilled: [], departmentCounts: {}, departmentsCount: 0 },
    };
  }
}
