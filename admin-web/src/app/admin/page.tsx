import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  AdminDashboardClientView,
  DashboardExamItem,
  DashboardViolationItem,
} from "./components/AdminDashboardClientView";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let activeExamsCount = 0;
  let scheduledExamsCount = 0;
  let completedExamsCount = 0;
  let onlineCandidatesCount = 0;
  let activeViolationsCount = 0;
  let totalQuestionsCount = 0;
  let totalDepartmentsCount = 0;
  let exams: DashboardExamItem[] = [];
  let recentViolations: DashboardViolationItem[] = [];
  let userEmail = "admin@kalasalingam.ac.in";

  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.email) {
      userEmail = authData.user.email;
    }

    const [
      { count: activeCount },
      { count: scheduledCount },
      { count: completedCount },
      { count: candidatesCount },
      { count: violationsCount },
      { count: questionsCount },
      { count: deptsCount },
      { data: examsData },
      { data: rawViolations },
    ] = await Promise.all([
      supabaseAdmin
        .from("exams")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIVE"),
      supabaseAdmin
        .from("exams")
        .select("*", { count: "exact", head: true })
        .eq("status", "SCHEDULED"),
      supabaseAdmin
        .from("exams")
        .select("*", { count: "exact", head: true })
        .eq("status", "COMPLETED"),
      supabaseAdmin
        .from("exam_sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "IN_PROGRESS"),
      supabaseAdmin.from("violation_logs").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("exam_questions").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("departments").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("exams")
        .select(`
          id,
          title,
          course_code,
          passcode,
          duration_minutes,
          max_strikes,
          status,
          start_time,
          end_time,
          created_at,
          exam_sessions (id, status)
        `)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("violation_logs")
        .select(`
          id,
          session_id,
          violation_type,
          strike_number,
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
        .limit(6),
    ]);

    activeExamsCount = activeCount ?? 0;
    scheduledExamsCount = scheduledCount ?? 0;
    completedExamsCount = completedCount ?? 0;
    onlineCandidatesCount = candidatesCount ?? 0;
    activeViolationsCount = violationsCount ?? 0;
    totalQuestionsCount = questionsCount ?? 0;
    totalDepartmentsCount = deptsCount ?? 0;

    if (examsData) {
      exams = examsData.map((e: any) => {
        const sessions = e.exam_sessions || [];
        const activeSess = sessions.filter((s: any) => s.status === "IN_PROGRESS").length;
        return {
          id: e.id,
          title: e.title,
          course_code: e.course_code,
          passcode: e.passcode,
          duration_minutes: e.duration_minutes,
          max_strikes: e.max_strikes,
          status: e.status,
          start_time: e.start_time,
          end_time: e.end_time,
          created_at: e.created_at,
          totalSessions: sessions.length,
          activeSessions: activeSess,
        };
      });
    }

    if (rawViolations) {
      recentViolations = rawViolations.map((v: any) => {
        const student = v.session?.student;
        const dept = Array.isArray(student?.department)
          ? student?.department[0]
          : student?.department;
        return {
          id: v.id,
          candidateName: student?.full_name || "Unknown Examinee",
          applicationNumber: student?.application_number || "",
          departmentCode: dept?.code || "GEN",
          examTitle: v.session?.exam?.title || "Examination",
          violationType: v.violation_type || "Integrity Violation",
          strikeNumber: v.strike_number || 1,
          createdAt: v.created_at,
        };
      });
    }
  } catch (err) {
    console.warn("Notice: Database query error during dashboard render:", err);
  }

  const stats = {
    activeExamsCount,
    scheduledExamsCount,
    completedExamsCount,
    onlineCandidatesCount,
    activeViolationsCount,
    totalQuestionsCount,
    totalDepartmentsCount,
  };

  return (
    <AdminDashboardClientView
      userEmail={userEmail}
      stats={stats}
      exams={exams}
      recentViolations={recentViolations}
    />
  );
}
