import { supabaseAdmin } from "@/lib/supabase/admin";
import { reconcileExamStatuses } from "@/lib/exam-reconciliation";
import {
  ProctoringSession,
  ViolationFeedItem,
  ExamClassificationItem,
  CandidateInquiryItem,
} from "./components/LiveProctoringClientView";

export interface ProctoringDataResult {
  sessions: ProctoringSession[];
  violations: ViolationFeedItem[];
  classifiedExams: ExamClassificationItem[];
  inquiries: CandidateInquiryItem[];
  currentExam: ExamClassificationItem | null;
}

export async function getProctoringData(targetExamId?: string): Promise<ProctoringDataResult> {
  let sessions: ProctoringSession[] = [];
  let violations: ViolationFeedItem[] = [];
  let classifiedExams: ExamClassificationItem[] = [];
  let inquiries: CandidateInquiryItem[] = [];
  let currentExam: ExamClassificationItem | null = null;

  try {
    // 0. Auto-conclude expired exams and auto-finalize lingering sessions against IST clock
    await reconcileExamStatuses(targetExamId);

    // 1. Fetch all exams with schedule and classification details
    const { data: examsData } = await supabaseAdmin
      .from("exams")
      .select("id, title, course_code, status, passcode, start_time, end_time, duration_minutes")
      .order("created_at", { ascending: false });

    classifiedExams = (examsData || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      courseCode: e.course_code || null,
      status: e.status,
      passcode: e.passcode || "",
      startTime: e.start_time || null,
      endTime: e.end_time || null,
      durationMinutes: e.duration_minutes || 90,
    }));

    if (targetExamId && targetExamId !== "ALL") {
      currentExam = classifiedExams.find((e) => e.id === targetExamId) || null;
    }

    // 2. Fetch live exam sessions with student, department, and exam info
    let sessionsQuery = supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        student_id,
        exam_id,
        hardware_fingerprint,
        client_version,
        status,
        strikes_count,
        extra_time_minutes,
        started_at,
        submitted_at,
        student:students (
          id,
          full_name,
          application_number,
          roll_number,
          email,
          department:departments (
            id,
            code,
            name
          )
        ),
        exam:exams (
          id,
          title,
          max_strikes,
          passcode
        )
      `)
      .order("started_at", { ascending: false });

    if (targetExamId && targetExamId !== "ALL") {
      sessionsQuery = sessionsQuery.eq("exam_id", targetExamId);
    }

    const { data: sessionsData, error: sessError } = await sessionsQuery;

    if (sessError) {
      console.warn("Proctoring sessions query error:", sessError);
    }

    // 3. Fetch count of submissions per session
    const { data: submissionsData } = await supabaseAdmin
      .from("submissions")
      .select("session_id");

    const submissionCounts = new Map<string, number>();
    (submissionsData || []).forEach((sub) => {
      submissionCounts.set(sub.session_id, (submissionCounts.get(sub.session_id) || 0) + 1);
    });

    // 4. Fetch recent violation logs & latest forensic snapshots
    const { data: rawViolations, error: violError } = await supabaseAdmin
      .from("violation_logs")
      .select(`
        id,
        session_id,
        violation_type,
        strike_number,
        snapshot_url,
        metadata,
        created_at,
        session:exam_sessions (
          id,
          exam_id,
          student:students (
            full_name,
            application_number,
            department:departments (code)
          ),
          exam:exams (id, title)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    // 4b. Fetch latest webcam snapshot per session
    const { data: rawSnapshots } = await supabaseAdmin
      .from("violation_logs")
      .select("id, session_id, snapshot_url, created_at")
      .not("snapshot_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(300);

    const latestSnapshotMap = new Map<string, { url: string; time: string; count: number }>();
    if (rawSnapshots) {
      for (const snap of rawSnapshots) {
        if (!snap.session_id || !snap.snapshot_url) continue;
        const existing = latestSnapshotMap.get(snap.session_id);
        if (!existing) {
          latestSnapshotMap.set(snap.session_id, {
            url: snap.snapshot_url,
            time: snap.created_at,
            count: 1,
          });
        } else {
          existing.count += 1;
        }
      }
    }

    const latestViolationMap = new Map<string, any>();
    if (rawViolations) {
      for (const v of rawViolations) {
        if (!v.session_id) continue;
        if (!latestViolationMap.has(v.session_id)) {
          latestViolationMap.set(v.session_id, v);
        }
      }
    }

    const lateEntryMap = new Map<string, any>();

    if (rawViolations) {
      const filteredViolations = (targetExamId && targetExamId !== "ALL"
        ? rawViolations.filter((v: any) => v.session?.exam_id === targetExamId || v.session?.exam?.id === targetExamId)
        : rawViolations
      ).filter((v: any) => {
        // Exclude routine background surveillance snapshots from the violation alerts feed
        const isLateAttempt = v.metadata?.event_type === "LATE_ENTRY_ATTEMPT";
        if (isLateAttempt) return true;
        if (v.metadata?.isSurveillance && v.strike_number === 0) return false;
        return true;
      });

      violations = filteredViolations.map((v: any) => {
        const isLateAttempt = v.metadata?.event_type === "LATE_ENTRY_ATTEMPT";
        if (isLateAttempt) {
          lateEntryMap.set(v.session_id, {
            ...v.metadata,
            attemptedAt: v.created_at,
          });
        }

        const displayType = isLateAttempt
          ? `LATE_ENTRY_ATTEMPT (+${v.metadata?.delayMinutes ?? 15}m)`
          : (v.metadata?.actualViolationType || v.violation_type || "Integrity Violation");

        return {
          id: v.id,
          sessionId: v.session_id,
          candidateName: v.session?.student?.full_name || "Unknown Candidate",
          applicationNumber: v.session?.student?.application_number || "",
          departmentCode: v.session?.student?.department?.code || "GENERAL",
          examTitle: v.session?.exam?.title || "Examination",
          violationType: displayType,
          strikeNumber: v.strike_number || (isLateAttempt ? 0 : 1),
          snapshotUrl: v.snapshot_url || null,
          createdAt: v.created_at,
          metadata: v.metadata,
        };
      });
    }

    if (sessionsData) {
      sessions = sessionsData.map((s: any) => {
        const student = s.student || {};
        const dept = student.department || {};
        const exam = s.exam || {};
        const lateDetails = lateEntryMap.get(s.id);
        const latestSnap = latestSnapshotMap.get(s.id);
        const latestViol = latestViolationMap.get(s.id);
        const subCount = submissionCounts.get(s.id) || 0;

        let latestActionText = "Active in Examination Sitting";
        let latestActionTime = s.started_at;
        let latestActionType: "ANSWER" | "VIOLATION" | "SYSTEM" | "INQUIRY" | "PROCTOR" = "SYSTEM";

        if (s.status === "SUBMITTED") {
          latestActionText = `Exam Submitted (${subCount} answers recorded)`;
          latestActionTime = s.submitted_at || s.started_at;
          latestActionType = "ANSWER";
        } else if (s.status === "LOCKED") {
          latestActionText = latestViol?.violation_type
            ? `Workstation Locked: ${latestViol.violation_type.replace(/_/g, " ")}`
            : "Workstation Locked by Invigilator";
          latestActionTime = latestViol?.created_at || s.updated_at || s.started_at;
          latestActionType = "VIOLATION";
        } else if (latestViol && new Date(latestViol.created_at).getTime() > new Date(s.started_at).getTime()) {
          if (latestViol.violation_type === "PROCTOR_WARNING") {
            latestActionText = "Proctor Warning Dispatched";
            latestActionType = "PROCTOR";
          } else if (latestViol.violation_type === "WINDOW_UNFOCUSED") {
            latestActionText = "Window Focus Lost / Minimized";
            latestActionType = "VIOLATION";
          } else if (latestViol.violation_type === "SYSTEM_HOTKEY_ATTEMPT") {
            latestActionText = "Blocked System HotKey (Alt+Tab/Win)";
            latestActionType = "VIOLATION";
          } else {
            latestActionText = latestViol.violation_type.replace(/_/g, " ");
            latestActionType = "VIOLATION";
          }
          latestActionTime = latestViol.created_at;
        } else if (subCount > 0) {
          latestActionText = `Progressing: ${subCount} Answers Saved`;
          latestActionType = "ANSWER";
          latestActionTime = s.updated_at || s.started_at;
        } else {
          latestActionText = "Sitting Active • Normal Behavior";
          latestActionType = "SYSTEM";
          latestActionTime = s.started_at;
        }

        return {
          id: s.id,
          studentId: s.student_id,
          candidateName: student.full_name || "Candidate",
          applicationNumber: student.application_number || student.roll_number || "",
          email: student.email || "",
          departmentCode: dept.code || "GENERAL",
          departmentName: dept.name || "General",
          examId: s.exam_id,
          examTitle: exam.title || "Examination",
          examPasscode: exam.passcode || "",
          maxStrikes: exam.max_strikes || 3,
          strikesCount: s.strikes_count || 0,
          status: s.status || "IN_PROGRESS",
          hardwareFingerprint: s.hardware_fingerprint || "UNBOUND",
          clientVersion: s.client_version || "1.0.0",
          extraTimeMinutes: s.extra_time_minutes || 0,
          startedAt: s.started_at,
          updatedAt: s.submitted_at || s.started_at,
          submissionsCount: subCount,
          isPendingLateEntry: Boolean(lateDetails && s.status === "LOCKED"),
          lateEntryDetails: lateDetails || null,
          recentViolations: [],
          latestSnapshotUrl: latestSnap?.url || null,
          latestSnapshotTime: latestSnap?.time || null,
          snapshotsCount: latestSnap?.count || 0,
          latestActionText,
          latestActionTime,
          latestActionType,
        };
      });
    }

    // 5. Fetch Candidate Support Inquiries & Messages
    const { data: rawInquiries } = await supabaseAdmin
      .from("proctor_actions")
      .select(`
        id,
        session_id,
        proctor_id,
        action_type,
        reason,
        action_payload,
        created_at,
        session:exam_sessions (
          id,
          exam_id,
          student:students (
            id,
            full_name,
            application_number,
            department:departments (code)
          ),
          exam:exams (
            id,
            title
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(80);

    if (rawInquiries) {
      inquiries = rawInquiries
        .filter((a: any) => {
          const type = a.action_payload?.type;
          const isChat = type === "CANDIDATE_MESSAGE" || type === "PROCTOR_REPLY";
          if (!isChat) return false;
          if (targetExamId && targetExamId !== "ALL") {
            const inqExamId = a.action_payload?.examId || a.session?.exam_id || a.session?.exam?.id;
            return inqExamId === targetExamId;
          }
          return true;
        })
        .map((a: any) => {
          const payload = a.action_payload || {};
          const sess = a.session || {};
          const st = sess.student || {};
          const ex = sess.exam || {};
          return {
            id: a.id,
            sessionId: a.session_id,
            messageId: payload.messageId || a.id,
            sender: payload.sender || (payload.type === "PROCTOR_REPLY" ? "PROCTOR" : "CANDIDATE"),
            category: payload.category || "GENERAL_DOUBT",
            questionNumber: payload.questionNumber || null,
            message: payload.message || a.reason || "",
            candidateName: payload.candidateName || st.full_name || "Candidate",
            applicationNumber: payload.applicationNumber || st.application_number || "",
            departmentCode: payload.departmentCode || st.department?.code || "GENERAL",
            examId: payload.examId || sess.exam_id || "",
            examTitle: payload.examTitle || ex.title || "Examination",
            status: payload.status || "UNREAD",
            createdAt: payload.timestamp || a.created_at,
          };
        });
    }
  } catch (err) {
    console.warn("Live proctoring query exception:", err);
  }

  return {
    sessions,
    violations,
    classifiedExams,
    inquiries,
    currentExam,
  };
}
