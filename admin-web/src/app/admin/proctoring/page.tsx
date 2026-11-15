import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  LiveProctoringClientView,
  ProctoringSession,
  ViolationFeedItem,
  ExamClassificationItem,
  CandidateInquiryItem,
} from "./components/LiveProctoringClientView";

export const dynamic = "force-dynamic";

export default async function LiveProctoringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let sessions: ProctoringSession[] = [];
  let violations: ViolationFeedItem[] = [];
  let classifiedExams: ExamClassificationItem[] = [];
  let inquiries: CandidateInquiryItem[] = [];

  try {
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

    // 2. Fetch live exam sessions with student, department, and exam info
    const { data: sessionsData, error: sessError } = await supabaseAdmin
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

    // 4. Fetch recent violation logs (including late entry alert telemetry)
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
          student:students (
            full_name,
            application_number,
            department:departments (code)
          ),
          exam:exams (title)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(30);

    const lateEntryMap = new Map<string, any>();

    if (rawViolations) {
      violations = rawViolations.map((v: any) => {
        const isLateAttempt = v.metadata?.event_type === "LATE_ENTRY_ATTEMPT";
        if (isLateAttempt) {
          lateEntryMap.set(v.session_id, {
            ...v.metadata,
            attemptedAt: v.created_at,
          });
        }

        return {
          id: v.id,
          sessionId: v.session_id,
          candidateName: v.session?.student?.full_name || "Unknown Candidate",
          applicationNumber: v.session?.student?.application_number || "",
          departmentCode: v.session?.student?.department?.code || "GENERAL",
          examTitle: v.session?.exam?.title || "Examination",
          violationType: isLateAttempt
            ? `LATE_ENTRY_ATTEMPT (+${v.metadata?.delayMinutes ?? 15}m)`
            : v.violation_type || "Integrity Violation",
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
          submissionsCount: submissionCounts.get(s.id) || 0,
          isPendingLateEntry: Boolean(lateDetails && s.status === "LOCKED"),
          lateEntryDetails: lateDetails || null,
          recentViolations: [],
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
      .limit(60);

    if (rawInquiries) {
      inquiries = rawInquiries
        .filter((a: any) => {
          const type = a.action_payload?.type;
          return type === "CANDIDATE_MESSAGE" || type === "PROCTOR_REPLY";
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

  return (
    <LiveProctoringClientView
      initialSessions={sessions}
      recentViolations={violations}
      exams={classifiedExams}
      initialInquiries={inquiries}
    />
  );
}

