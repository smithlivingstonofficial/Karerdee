import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { StudentClientView, StudentRecord } from "./components/StudentClientView";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let departments: { id: string; name: string; code: string }[] = [];
  let studentsData: StudentRecord[] = [];

  try {
    // 1. Fetch departments
    const { data: deptData } = await supabaseAdmin
      .from("departments")
      .select("id, name, code")
      .order("code", { ascending: true });

    departments = deptData || [];

    // 2. Fetch candidates with their department
    const { data: students } = await supabaseAdmin
      .from("students")
      .select(`
        id,
        auth_user_id,
        full_name,
        application_number,
        email,
        department_id,
        created_at,
        department:departments(id, name, code)
      `)
      .order("created_at", { ascending: false });

    // 3. Fetch active and recent exam sessions to check workstation binding
    const { data: allSessions } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        student_id,
        hardware_fingerprint,
        client_version,
        status,
        started_at,
        strikes_count,
        exam:exams (
          id,
          title,
          status
        )
      `)
      .order("started_at", { ascending: false });

    // Map each student to their most relevant active or recent session
    const sessionByStudentId = new Map<string, any>();
    (allSessions || []).forEach((sess: any) => {
      const existing = sessionByStudentId.get(sess.student_id);
      if (!existing) {
        sessionByStudentId.set(sess.student_id, sess);
      } else {
        const isCurrentActive = ["IN_PROGRESS", "LOCKED", "PAUSED"].includes(sess.status);
        const isExistingActive = ["IN_PROGRESS", "LOCKED", "PAUSED"].includes(existing.status);
        if (isCurrentActive && !isExistingActive) {
          sessionByStudentId.set(sess.student_id, sess);
        }
      }
    });

    if (students) {
      studentsData = students.map((s: any) => {
        const activeSess = sessionByStudentId.get(s.id);
        const examObj = activeSess?.exam
          ? Array.isArray(activeSess.exam)
            ? activeSess.exam[0]
            : activeSess.exam
          : null;

        return {
          id: s.id,
          full_name: s.full_name,
          application_number: s.application_number || s.roll_number || "",
          email: s.email,
          department_id: s.department_id,
          created_at: s.created_at,
          department: s.department ? (Array.isArray(s.department) ? s.department[0] : s.department) : null,
          activeSession: activeSess
            ? {
                id: activeSess.id,
                hardware_fingerprint: activeSess.hardware_fingerprint || "",
                client_version: activeSess.client_version || "SafeExam Client",
                status: activeSess.status,
                started_at: activeSess.started_at,
                strikes_count: activeSess.strikes_count || 0,
                examTitle: examObj?.title || undefined,
                examId: examObj?.id || undefined,
              }
            : null,
        };
      });
    }
  } catch (err) {
    console.warn("Notice: Students query error:", err);
  }

  return (
    <StudentClientView
      initialStudents={studentsData}
      departments={departments}
    />
  );
}
