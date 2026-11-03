import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { QuestionsClientView } from "./components/QuestionsClientView";
import { DepartmentQuestion, Department } from "@/types/database.types";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let departments: Department[] = [];
  let questions: DepartmentQuestion[] = [];

  try {
    // 1. Fetch all departments
    const { data: deptData } = await supabaseAdmin
      .from("departments")
      .select("id, name, code, created_at")
      .order("code", { ascending: true });

    departments = (deptData as Department[]) || [];

    // 2. Fetch all questions (both general where department_id IS NULL, and department-specific)
    const { data: qData, error: qError } = await supabaseAdmin
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
          question_id,
          option_text,
          is_correct,
          order_index
        )
      `)
      .order("created_at", { ascending: false });

    if (qError) {
      console.warn("Questions master query error:", qError);
    }

    if (qData) {
      questions = qData.map((q: any) => ({
        ...q,
        department: q.department ? (Array.isArray(q.department) ? q.department[0] : q.department) : null,
        options: (q.options || []).sort((a: any, b: any) => a.order_index - b.order_index),
      }));
    }
  } catch (err) {
    console.warn("Questions master load exception:", err);
  }

  return (
    <QuestionsClientView
      initialQuestions={questions}
      departments={departments}
    />
  );
}

