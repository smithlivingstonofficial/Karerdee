import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LiveProctoringClientView, ProctoringSession, ViolationFeedItem } from "./components/LiveProctoringClientView";

export const dynamic = "force-dynamic";

export default async function LiveProctoringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let sessions: ProctoringSession[] = [];
  let violations: ViolationFeedItem[] = [];
  let activeExams: { id: string; title: string; status: string; passcode: string }[] = [];

  try {
    // 1. Fetch active/scheduled exams
    const { data: examsData } = await supabaseAdmin
      .from("exams")
      .select("id, title, status, passcode")
      .in("status", ["ACTIVE", "SCHEDULED", "DRAFT"])
      .order("created_at", { ascending: false });

    activeExams = examsData || [];

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
  } catch (err) {
    console.warn("Live proctoring query exception:", err);
  }

  return (
    <LiveProctoringClientView
      initialSessions={sessions}
      recentViolations={violations}
      exams={activeExams}
    />
  );
}

