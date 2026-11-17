import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseDate, formatDateTime } from "@/lib/date";

export interface ExamTimingAnalysis {
  examId: string;
  title: string;
  status: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  lateEntryGraceMinutes: number;
  lateEntryCutoff: Date;
  autoConcludeDeadline: Date;
  isCommenced: boolean;
  isEntryWindowOpen: boolean;
  isConcluded: boolean;
}

export interface ReconcileResult {
  success: boolean;
  timestamp: string;
  serverTimeIST: string;
  concludedExams: { id: string; title: string; cutoffIST: string }[];
  activatedExams: { id: string; title: string; startTimeIST: string }[];
  finalizedSessionsCount: number;
}

/**
 * Calculates deterministic timing boundaries for an exam based on IST server time and exam configuration.
 */
export function computeExamTimingDetails(
  exam: {
    id: string;
    title: string;
    status: string;
    start_time?: string | null;
    end_time?: string | null;
    duration_minutes?: number | null;
    created_at?: string | null;
    config?: Record<string, any> | null;
  },
  maxSessionExtraTimeMinutes = 0
): ExamTimingAnalysis {
  const durationMinutes = exam.duration_minutes && exam.duration_minutes > 0 ? exam.duration_minutes : 90;
  
  // 1. Resolve Start Time
  let startTime = parseDate(exam.start_time);
  if (!startTime) {
    startTime = parseDate(exam.created_at) || new Date();
  }

  // 2. Resolve End Time
  let endTime = parseDate(exam.end_time);
  if (!endTime) {
    endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  }

  // 3. Resolve Grace Period (from exam.config.late_entry_buffer_minutes or default 15 mins)
  const config = exam.config || {};
  const lateEntryGraceMinutes = Number(config.late_entry_buffer_minutes ?? 15);

  // 4. Compute Cutoffs
  const lateEntryCutoff = new Date(startTime.getTime() + lateEntryGraceMinutes * 60 * 1000);

  // Auto-conclude deadline: scheduled end time + late entry grace buffer + any proctor-granted compensatory time
  const autoConcludeDeadline = new Date(
    endTime.getTime() + (lateEntryGraceMinutes + maxSessionExtraTimeMinutes) * 60 * 1000
  );

  const nowEpoch = Date.now();
  const isCommenced = nowEpoch >= startTime.getTime();
  const isEntryWindowOpen = isCommenced && nowEpoch <= lateEntryCutoff.getTime();
  const isConcluded = nowEpoch >= autoConcludeDeadline.getTime();

  return {
    examId: exam.id,
    title: exam.title,
    status: exam.status,
    startTime,
    endTime,
    durationMinutes,
    lateEntryGraceMinutes,
    lateEntryCutoff,
    autoConcludeDeadline,
    isCommenced,
    isEntryWindowOpen,
    isConcluded,
  };
}

/**
 * Automatically evaluates candidate responses and finalizes an in-progress or locked session upon exam conclusion.
 */
async function autoFinalizeSession(sessionId: string, examId: string, isNegativeMarking: boolean): Promise<number> {
  try {
    // 1. Fetch questions with options for auto-grading
    const { data: dbQuestions } = await supabaseAdmin
      .from("exam_questions")
      .select(`
        id,
        points,
        negative_points,
        question_type,
        options:question_options(
          id,
          is_correct
        )
      `)
      .eq("exam_id", examId);

    const questionsMap = new Map<string, any>();
    (dbQuestions || []).forEach((q: any) => questionsMap.set(q.id, q));

    // 2. Fetch existing submissions for this session
    const { data: userSubmissions } = await supabaseAdmin
      .from("submissions")
      .select("id, question_id, selected_option_ids, subjective_text")
      .eq("session_id", sessionId);

    let totalScore = 0;
    const submissionUpdates: any[] = [];

    for (const sub of userSubmissions || []) {
      const q = questionsMap.get(sub.question_id);
      let awardedMarks = 0;

      if (q && q.options && q.options.length > 0) {
        const correctOptIds = new Set<string>(
          q.options.filter((o: any) => o.is_correct).map((o: any) => o.id)
        );
        const selectedIds = sub.selected_option_ids || [];

        if (selectedIds.length > 0) {
          const isAllCorrect =
            selectedIds.length === correctOptIds.size &&
            selectedIds.every((id: string) => correctOptIds.has(id));

          if (isAllCorrect) {
            awardedMarks = Number(q.points) || 1;
          } else if (isNegativeMarking) {
            awardedMarks = -(Number(q.negative_points) || 0);
          }
          totalScore += awardedMarks;
        }
      }

      submissionUpdates.push({
        id: sub.id,
        session_id: sessionId,
        question_id: sub.question_id,
        selected_option_ids: sub.selected_option_ids,
        subjective_text: sub.subjective_text,
        awarded_points: awardedMarks,
        is_auto_graded: true,
      });
    }

    if (submissionUpdates.length > 0) {
      await supabaseAdmin.from("submissions").upsert(submissionUpdates, { onConflict: "id" });
    }

    const finalScore = Math.max(0, totalScore);
    const submittedAt = new Date().toISOString();

    await supabaseAdmin
      .from("exam_sessions")
      .update({
        status: "SUBMITTED",
        submitted_at: submittedAt,
        auto_score: finalScore,
      })
      .eq("id", sessionId);

    return finalScore;
  } catch (err) {
    console.error(`Failed to auto-finalize session ${sessionId}:`, err);
    // Fallback: force status to SUBMITTED so session does not remain hanging
    await supabaseAdmin
      .from("exam_sessions")
      .update({
        status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    return 0;
  }
}

/**
 * Reconciles examination statuses against authoritative IST server timing and grace periods.
 * 
 * 1. Concludes any examination whose scheduled end time + grace period has passed (marks COMPLETED).
 * 2. Auto-finalizes any lingering candidate sessions for concluded exams (marks SUBMITTED and auto-grades).
 * 3. Activates any SCHEDULED exam whose start time has arrived (marks ACTIVE).
 */
export async function reconcileExamStatuses(targetExamId?: string): Promise<ReconcileResult> {
  const serverNow = new Date();
  const concludedExams: { id: string; title: string; cutoffIST: string }[] = [];
  const activatedExams: { id: string; title: string; startTimeIST: string }[] = [];
  let finalizedSessionsCount = 0;

  try {
    // 1. Query exams that are currently ACTIVE, ONGOING, or SCHEDULED
    let examsQuery = supabaseAdmin
      .from("exams")
      .select("id, title, status, start_time, end_time, duration_minutes, created_at, config, enable_negative_marking")
      .in("status", ["ACTIVE", "ONGOING", "SCHEDULED"]);

    if (targetExamId && targetExamId !== "ALL") {
      examsQuery = examsQuery.eq("id", targetExamId);
    }

    const { data: candidateExams, error: examsErr } = await examsQuery;

    if (examsErr || !candidateExams || candidateExams.length === 0) {
      return {
        success: true,
        timestamp: serverNow.toISOString(),
        serverTimeIST: formatDateTime(serverNow, true, true),
        concludedExams,
        activatedExams,
        finalizedSessionsCount,
      };
    }

    // 2. Fetch max extra time minutes for active sessions to prevent concluding while a student is in approved extra time
    const examIds = candidateExams.map((e) => e.id);
    const { data: activeSessions } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, exam_id, status, extra_time_minutes")
      .in("exam_id", examIds)
      .in("status", ["IN_PROGRESS", "LOCKED", "PAUSED"]);

    const maxExtraTimeByExam = new Map<string, number>();
    (activeSessions || []).forEach((sess) => {
      const currentMax = maxExtraTimeByExam.get(sess.exam_id) || 0;
      const sessExtra = Number(sess.extra_time_minutes || 0);
      if (sessExtra > currentMax) {
        maxExtraTimeByExam.set(sess.exam_id, sessExtra);
      }
    });

    // 3. Process each exam against IST server clock
    for (const exam of candidateExams) {
      const maxExtra = maxExtraTimeByExam.get(exam.id) || 0;
      const timing = computeExamTimingDetails(exam, maxExtra);

      // Condition A: Exam has reached or exceeded its scheduled end time + grace period
      if (timing.isConcluded) {
        console.log(
          `[Exam Reconcile] Auto-concluding expired exam "${exam.title}" (${exam.id}). Cutoff was: ${formatDateTime(
            timing.autoConcludeDeadline,
            false,
            true
          )}`
        );

        // Mark exam as COMPLETED
        const { error: updateErr } = await supabaseAdmin
          .from("exams")
          .update({ status: "COMPLETED" })
          .eq("id", exam.id);

        if (!updateErr) {
          concludedExams.push({
            id: exam.id,
            title: exam.title,
            cutoffIST: formatDateTime(timing.autoConcludeDeadline, false, true),
          });

          // Finalize lingering active sessions for this exam
          const lingeringSessions = (activeSessions || []).filter((s) => s.exam_id === exam.id);
          const isNeg = Boolean(exam.enable_negative_marking);

          for (const s of lingeringSessions) {
            await autoFinalizeSession(s.id, exam.id, isNeg);
            finalizedSessionsCount++;
          }
        }
      }
      // Condition B: Exam was SCHEDULED and its scheduled start time has arrived
      else if (exam.status === "SCHEDULED" && timing.isCommenced && !timing.isConcluded) {
        console.log(
          `[Exam Reconcile] Auto-activating scheduled exam "${exam.title}" (${exam.id}). Commenced at: ${formatDateTime(
            timing.startTime,
            false,
            true
          )}`
        );

        const { error: activateErr } = await supabaseAdmin
          .from("exams")
          .update({ status: "ACTIVE" })
          .eq("id", exam.id);

        if (!activateErr) {
          activatedExams.push({
            id: exam.id,
            title: exam.title,
            startTimeIST: formatDateTime(timing.startTime, false, true),
          });
        }
      }
    }

    return {
      success: true,
      timestamp: serverNow.toISOString(),
      serverTimeIST: formatDateTime(serverNow, true, true),
      concludedExams,
      activatedExams,
      finalizedSessionsCount,
    };
  } catch (err: any) {
    console.error("[Exam Reconcile] Unexpected error during status reconciliation:", err);
    return {
      success: false,
      timestamp: serverNow.toISOString(),
      serverTimeIST: formatDateTime(serverNow, true, true),
      concludedExams,
      activatedExams,
      finalizedSessionsCount,
    };
  }
}
