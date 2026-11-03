import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DepartmentClientView } from "./components/DepartmentClientView";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let departmentsWithCount: any[] = [];

  try {
    const { data: departments, error } = await supabaseAdmin
      .from("departments")
      .select("id, name, code, created_at")
      .order("code", { ascending: true });

    if (error) {
      console.error("Departments query error:", error);
    }

    if (departments && departments.length > 0) {
      // Fetch student counts and question repository counts for each department
      departmentsWithCount = await Promise.all(
        departments.map(async (d) => {
          let sCount = 0;
          let qCount = 0;

          try {
            const [{ count: studentCount }, { count: questionCount }] = await Promise.all([
              supabaseAdmin
                .from("students")
                .select("*", { count: "exact", head: true })
                .eq("department_id", d.id),
              supabaseAdmin
                .from("department_questions")
                .select("*", { count: "exact", head: true })
                .eq("department_id", d.id),
            ]);
            sCount = studentCount ?? 0;
            qCount = questionCount ?? 0;
          } catch (e) {
            // Table might not exist yet if migration pending
          }

          return {
            ...d,
            studentCount: sCount,
            questionCount: qCount,
          };
        })
      );
    }
  } catch (err) {
    console.warn("Notice: Departments query error:", err);
  }

  return <DepartmentClientView initialDepartments={departmentsWithCount} />;
}
