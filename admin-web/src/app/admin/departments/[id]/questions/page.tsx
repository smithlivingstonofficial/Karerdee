import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DepartmentQuestionsClientView } from "./components/DepartmentQuestionsClientView";
import { DepartmentQuestion } from "@/types/database.types";

export const dynamic = "force-dynamic";

interface DepartmentQuestionsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DepartmentQuestionsPage({
  params,
}: DepartmentQuestionsPageProps) {
  const resolvedParams = await params;
  const departmentId = resolvedParams.id;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch Department Details
  const { data: department, error: deptError } = await supabaseAdmin
    .from("departments")
    .select("id, name, code")
    .eq("id", departmentId)
    .maybeSingle();

  if (deptError || !department) {
    notFound();
  }

  // 2. Fetch Department Questions with Options
  let questions: DepartmentQuestion[] = [];

  try {
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
        options:department_question_options (
          id,
          question_id,
          option_text,
          is_correct,
          order_index
        )
      `)
      .eq("department_id", departmentId)
      .order("created_at", { ascending: false });

    if (qError) {
      console.warn("Department questions query error:", qError);
    }

    if (qData) {
      questions = qData.map((q: any) => ({
        ...q,
        options: (q.options || []).sort((a: any, b: any) => a.order_index - b.order_index),
      }));
    }
  } catch (err) {
    console.warn("Questions load exception:", err);
  }

  return (
    <DepartmentQuestionsClientView
      department={department}
      initialQuestions={questions}
    />
  );
}

