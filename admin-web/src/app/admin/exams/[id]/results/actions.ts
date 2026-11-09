"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CandidateQuestionResult {
  questionId: string;
  sectionTitle: string;
  prompt: string;
  questionType: string;
  points: number;
  negativePoints: number;
  selectedOptionIds: string[];
  selectedOptionTexts: string[];
  correctOptionIds: string[];
  correctOptionTexts: string[];
  awardedPoints: number;
  isCorrect: boolean;
  isAttempted: boolean;
}

export interface CandidateGradebookItem {
  sessionId?: string;
  studentId: string;
  applicationNumber: string;
  fullName: string;
  email: string;
  departmentCode: string;
  departmentName: string;
  status: "SUBMITTED" | "IN_PROGRESS" | "LOCKED" | "DISQUALIFIED" | "ABSENT";
  score: number;
  maxScore: number;
  percentage: number;
  result: "PASS" | "FAIL" | "PENDING";
  startedAt?: string | null;
  submittedAt?: string | null;
  durationMinutes: number;
  strikesCount: number;
  clientType: "Web Browser" | "Windows Desktop" | "Unbound";
  questionsAttempted: number;
  totalQuestions: number;
  questionBreakdown: CandidateQuestionResult[];
}

export interface QuestionAnalyticsItem {
  questionId: string;
  sectionTitle: string;
  prompt: string;
  orderIndex: number;
  points: number;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  skippedAttempts: number;
  accuracyRate: number; // percentage
  difficultyRating: "EASY" | "MEDIUM" | "HARD";
}

export interface DepartmentAnalyticsItem {
  departmentCode: string;
  departmentName: string;
  enrolledCount: number;
  appearedCount: number;
  submittedCount: number;
  passCount: number;
  passRate: number;
  averageScore: number;
  averagePercentage: number;
}

export interface ExamGradebookData {
  exam: {
    id: string;
    title: string;
    courseCode?: string | null;
    status: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    maxStrikes: number;
    enableNegativeMarking: boolean;
    passingScorePercentage: number;
    totalPossiblePoints: number;
  };
  metrics: {
    totalEnrolled: number;
    totalAppeared: number;
    totalSubmitted: number;
    passCount: number;
    failCount: number;
    overallPassRate: number;
    averageScore: number;
    averagePercentage: number;
    highestScore: number;
    lowestScore: number;
    medianScore: number;
    totalViolationsRecorded: number;
  };
  candidates: CandidateGradebookItem[];
  questionAnalytics: QuestionAnalyticsItem[];
  departmentBreakdown: DepartmentAnalyticsItem[];
}

export async function getExamGradebookAction(examId: string): Promise<{
  data?: ExamGradebookData;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Unauthorized. Admin authentication required." };
    }

    // 1. Fetch Exam Details
    const { data: exam, error: examErr } = await supabaseAdmin
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();

    if (examErr || !exam) {
      return { error: examErr?.message || "Examination not found." };
    }

    const examConfig = (exam.config as any) || {};
    const passingScorePercentage = Number(examConfig.passing_score ?? 50);

    // 2. Fetch Sections & Questions with Options
    const { data: sections } = await supabaseAdmin
      .from("exam_sections")
      .select("id, title, order_index, is_common, target_departments")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    const sectionTitleMap = new Map<string, string>();
    (sections || []).forEach((sec) => {
      sectionTitleMap.set(sec.id, sec.title);
    });

    const { data: dbQuestions, error: qErr } = await supabaseAdmin
      .from("exam_questions")
      .select(`
        id,
        section_id,
        prompt,
        points,
        negative_points,
        question_type,
        order_index,
        rubric_criteria,
        question_options (
          id,
          option_text,
          is_correct,
          order_index
        )
      `)
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });

    if (qErr) {
      return { error: qErr.message || "Failed to load examination questions." };
    }

    // Question lookup map
    const questionsMap = new Map<string, any>();
    let totalPossiblePoints = 0;

    (dbQuestions || []).forEach((q: any) => {
      questionsMap.set(q.id, q);
      totalPossiblePoints += Number(q.points) || 1;
    });

    // 3. Fetch Eligible Students (Enrolled Roster)
    const targetDeptCodes = new Set<string>();
    (sections || []).forEach((sec: any) => {
      if (sec.target_departments && Array.isArray(sec.target_departments)) {
        sec.target_departments.forEach((c: string) => {
          if (c?.trim()) targetDeptCodes.add(c.trim().toUpperCase());
        });
      }
    });

    const { data: studentsData, error: stuErr } = await supabaseAdmin
      .from("students")
      .select(`
        id,
        application_number,
        roll_number,
        full_name,
        email,
        is_active,
        department:departments (
          id,
          code,
          name
        )
      `)
      .eq("is_active", true)
      .order("application_number", { ascending: true });

    if (stuErr) {
      return { error: stuErr.message || "Failed to load candidate roster." };
    }

    const eligibleStudents = (studentsData || []).filter((s: any) => {
      if (targetDeptCodes.size === 0) return true;
      const deptObj = Array.isArray(s.department) ? s.department[0] : s.department;
      const deptCode = deptObj?.code?.toUpperCase();
      return deptCode && targetDeptCodes.has(deptCode);
    });

    // 4. Fetch All Sessions for this Exam
    const { data: sessions, error: sessErr } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        exam_id,
        student_id,
        status,
        strikes_count,
        extra_time_minutes,
        hardware_fingerprint,
        started_at,
        submitted_at,
        auto_score,
        final_score
      `)
      .eq("exam_id", examId);

    if (sessErr) {
      return { error: sessErr.message || "Failed to load exam sessions." };
    }

    const sessionByStudentId = new Map<string, any>();
    const sessionIds: string[] = [];

    (sessions || []).forEach((sess: any) => {
      sessionByStudentId.set(sess.student_id, sess);
      sessionIds.push(sess.id);
    });

    // 5. Fetch Submissions for All Sessions in this Exam
    let submissionsBySession = new Map<string, any[]>();
    if (sessionIds.length > 0) {
      const { data: subsData } = await supabaseAdmin
        .from("submissions")
        .select(`
          session_id,
          question_id,
          selected_option_ids,
          awarded_points,
          is_auto_graded
        `)
        .in("session_id", sessionIds);

      (subsData || []).forEach((sub: any) => {
        const existing = submissionsBySession.get(sub.session_id) || [];
        existing.push(sub);
        submissionsBySession.set(sub.session_id, existing);
      });
    }

    // 6. Aggregate Candidate Gradebook Items
    const candidatesList: CandidateGradebookItem[] = [];
    let sumScore = 0;
    let highest = 0;
    let lowest = 999999;
    let submittedCount = 0;
    let appearedCount = 0;
    let passCount = 0;
    let failCount = 0;
    const scoresForMedian: number[] = [];
    let totalViolationsRecorded = 0;

    // Track question-level stats
    const questionStatsMap = new Map<
      string,
      { attempts: number; correct: number; incorrect: number; skipped: number }
    >();

    (dbQuestions || []).forEach((q: any) => {
      questionStatsMap.set(q.id, { attempts: 0, correct: 0, incorrect: 0, skipped: 0 });
    });

    for (const student of eligibleStudents) {
      const sess = sessionByStudentId.get(student.id);
      const isAppeared = Boolean(sess && sess.started_at);
      const isSubmitted = sess?.status === "SUBMITTED";

      if (isAppeared) appearedCount++;
      if (isSubmitted) submittedCount++;

      let calculatedScore = 0;
      if (sess) {
        totalViolationsRecorded += sess.strikes_count || 0;
        if (typeof sess.auto_score === "number") {
          calculatedScore = sess.auto_score;
        } else if (typeof sess.final_score === "number") {
          calculatedScore = sess.final_score;
        }
      }

      // Calculate time spent
      let durationMinutes = 0;
      if (sess?.started_at && sess?.submitted_at) {
        const startMs = new Date(sess.started_at).getTime();
        const endMs = new Date(sess.submitted_at).getTime();
        durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
      } else if (sess?.started_at) {
        const startMs = new Date(sess.started_at).getTime();
        durationMinutes = Math.max(0, Math.round((Date.now() - startMs) / 60000));
      }

      // Resolve Client Type
      let clientType: "Web Browser" | "Windows Desktop" | "Unbound" = "Unbound";
      if (sess?.hardware_fingerprint) {
        const fp = sess.hardware_fingerprint.toUpperCase();
        if (fp.startsWith("WEB") || fp.startsWith("BROWSER")) {
          clientType = "Web Browser";
        } else if (fp !== "UNBOUND" && fp !== "UNBOUND_RESET_BY_ADMIN") {
          clientType = "Windows Desktop";
        }
      }

      // Build Question Breakdown for this student
      const userSubmissions = sess ? submissionsBySession.get(sess.id) || [] : [];
      const userSubMap = new Map<string, any>();
      userSubmissions.forEach((sub: any) => {
        userSubMap.set(sub.question_id, sub);
      });

      const questionBreakdown: CandidateQuestionResult[] = [];
      let attemptedCount = 0;

      (dbQuestions || []).forEach((q: any) => {
        const sectionTitle = sectionTitleMap.get(q.section_id) || "General";
        const optionsList = q.question_options || [];
        const optMap = new Map<string, string>();
        const correctOptIds: string[] = [];
        const correctOptTexts: string[] = [];

        optionsList.forEach((o: any) => {
          optMap.set(o.id, o.option_text);
          if (o.is_correct) {
            correctOptIds.push(o.id);
            correctOptTexts.push(o.option_text);
          }
        });

        const sub = userSubMap.get(q.id);
        const selectedIds: string[] = sub?.selected_option_ids || [];
        const selectedTexts = selectedIds.map((id) => optMap.get(id) || "Option");
        const isAttempted = selectedIds.length > 0;
        if (isAttempted) attemptedCount++;

        let awardedPoints = Number(sub?.awarded_points || 0);
        let isCorrect = false;

        if (isAttempted && correctOptIds.length > 0) {
          const isExactMatch =
            selectedIds.length === correctOptIds.length &&
            selectedIds.every((id) => correctOptIds.includes(id));
          if (isExactMatch) {
            isCorrect = true;
          }
        }

        // Update question item analysis stats if session submitted
        if (isSubmitted) {
          const qStat = questionStatsMap.get(q.id);
          if (qStat) {
            if (isAttempted) {
              qStat.attempts++;
              if (isCorrect) {
                qStat.correct++;
              } else {
                qStat.incorrect++;
              }
            } else {
              qStat.skipped++;
            }
          }
        }

        questionBreakdown.push({
          questionId: q.id,
          sectionTitle,
          prompt: q.prompt,
          questionType: q.question_type,
          points: Number(q.points) || 1,
          negativePoints: Number(q.negative_points) || 0,
          selectedOptionIds: selectedIds,
          selectedOptionTexts: selectedTexts,
          correctOptionIds: correctOptIds,
          correctOptionTexts: correctOptTexts,
          awardedPoints,
          isCorrect,
          isAttempted,
        });
      });

      // Recalculate score from submissions if auto_score was missing
      if (sess && typeof sess.auto_score !== "number" && typeof sess.final_score !== "number") {
        calculatedScore = Math.max(
          0,
          questionBreakdown.reduce((acc, curr) => acc + curr.awardedPoints, 0)
        );
      }

      const percentage =
        totalPossiblePoints > 0
          ? Math.round((calculatedScore / totalPossiblePoints) * 1000) / 10
          : 0;

      let result: "PASS" | "FAIL" | "PENDING" = "PENDING";
      if (isSubmitted) {
        result = percentage >= passingScorePercentage ? "PASS" : "FAIL";
        if (result === "PASS") passCount++;
        else failCount++;

        sumScore += calculatedScore;
        scoresForMedian.push(calculatedScore);
        if (calculatedScore > highest) highest = calculatedScore;
        if (calculatedScore < lowest) lowest = calculatedScore;
      }

      const status: "SUBMITTED" | "IN_PROGRESS" | "LOCKED" | "DISQUALIFIED" | "ABSENT" = sess
        ? (sess.status as any)
        : "ABSENT";

      const deptObj = Array.isArray((student as any).department)
        ? (student as any).department[0]
        : (student as any).department;

      candidatesList.push({
        sessionId: sess?.id,
        studentId: student.id,
        applicationNumber:
          student.application_number || student.roll_number || student.id.slice(0, 8).toUpperCase(),
        fullName: student.full_name,
        email: student.email,
        departmentCode: deptObj?.code || "GEN",
        departmentName: deptObj?.name || "General Discipline",
        status,
        score: calculatedScore,
        maxScore: totalPossiblePoints,
        percentage,
        result,
        startedAt: sess?.started_at,
        submittedAt: sess?.submitted_at,
        durationMinutes,
        strikesCount: sess?.strikes_count || 0,
        clientType,
        questionsAttempted: attemptedCount,
        totalQuestions: (dbQuestions || []).length,
        questionBreakdown,
      });
    }

    if (lowest === 999999) lowest = 0;

    // Sort scores for median
    scoresForMedian.sort((a, b) => a - b);
    let medianScore = 0;
    if (scoresForMedian.length > 0) {
      const mid = Math.floor(scoresForMedian.length / 2);
      medianScore =
        scoresForMedian.length % 2 !== 0
          ? scoresForMedian[mid]
          : (scoresForMedian[mid - 1] + scoresForMedian[mid]) / 2;
    }

    const averageScore =
      submittedCount > 0 ? Math.round((sumScore / submittedCount) * 10) / 10 : 0;
    const averagePercentage =
      totalPossiblePoints > 0 ? Math.round((averageScore / totalPossiblePoints) * 1000) / 10 : 0;
    const overallPassRate =
      submittedCount > 0 ? Math.round((passCount / submittedCount) * 1000) / 10 : 0;

    // 7. Department Breakdown Calculation
    const deptMap = new Map<
      string,
      {
        name: string;
        enrolled: number;
        appeared: number;
        submitted: number;
        pass: number;
        sumScores: number;
      }
    >();

    candidatesList.forEach((c) => {
      const dCode = c.departmentCode;
      const existing = deptMap.get(dCode) || {
        name: c.departmentName,
        enrolled: 0,
        appeared: 0,
        submitted: 0,
        pass: 0,
        sumScores: 0,
      };

      existing.enrolled++;
      if (c.status !== "ABSENT") existing.appeared++;
      if (c.status === "SUBMITTED") {
        existing.submitted++;
        if (c.result === "PASS") existing.pass++;
        existing.sumScores += c.score;
      }

      deptMap.set(dCode, existing);
    });

    const departmentBreakdown: DepartmentAnalyticsItem[] = Array.from(deptMap.entries()).map(
      ([code, d]) => {
        const avg = d.submitted > 0 ? Math.round((d.sumScores / d.submitted) * 10) / 10 : 0;
        const avgPct =
          totalPossiblePoints > 0 ? Math.round((avg / totalPossiblePoints) * 1000) / 10 : 0;
        const passRate =
          d.submitted > 0 ? Math.round((d.pass / d.submitted) * 1000) / 10 : 0;

        return {
          departmentCode: code,
          departmentName: d.name,
          enrolledCount: d.enrolled,
          appearedCount: d.appeared,
          submittedCount: d.submitted,
          passCount: d.pass,
          passRate,
          averageScore: avg,
          averagePercentage: avgPct,
        };
      }
    );

    // 8. Question Item Analysis
    const questionAnalytics: QuestionAnalyticsItem[] = (dbQuestions || []).map((q: any) => {
      const stat = questionStatsMap.get(q.id) || {
        attempts: 0,
        correct: 0,
        incorrect: 0,
        skipped: 0,
      };
      const totalExamined = submittedCount;
      const accuracyRate =
        totalExamined > 0 ? Math.round((stat.correct / totalExamined) * 1000) / 10 : 0;

      let difficultyRating: "EASY" | "MEDIUM" | "HARD" = "MEDIUM";
      if (accuracyRate >= 70) difficultyRating = "EASY";
      else if (accuracyRate < 40) difficultyRating = "HARD";

      return {
        questionId: q.id,
        sectionTitle: sectionTitleMap.get(q.section_id) || "General",
        prompt: q.prompt,
        orderIndex: q.order_index,
        points: Number(q.points) || 1,
        totalAttempts: stat.attempts,
        correctAttempts: stat.correct,
        incorrectAttempts: stat.incorrect,
        skippedAttempts: stat.skipped,
        accuracyRate,
        difficultyRating,
      };
    });

    return {
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          courseCode: exam.course_code,
          status: exam.status,
          startTime: exam.start_time,
          endTime: exam.end_time,
          durationMinutes: exam.duration_minutes || 90,
          maxStrikes: exam.max_strikes || 3,
          enableNegativeMarking: Boolean(exam.enable_negative_marking),
          passingScorePercentage,
          totalPossiblePoints,
        },
        metrics: {
          totalEnrolled: eligibleStudents.length,
          totalAppeared: appearedCount,
          totalSubmitted: submittedCount,
          passCount,
          failCount,
          overallPassRate,
          averageScore,
          averagePercentage,
          highestScore: highest,
          lowestScore: lowest,
          medianScore,
          totalViolationsRecorded,
        },
        candidates: candidatesList,
        questionAnalytics,
        departmentBreakdown,
      },
    };
  } catch (err: any) {
    console.error("Exam gradebook action exception:", err);
    return { error: err.message || "Failed to compile examination gradebook." };
  }
}
