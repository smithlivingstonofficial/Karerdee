import { createClient } from "@/lib/supabase/server";
import { getProctoringData } from "../data";
import { LiveProctoringClientView } from "../components/LiveProctoringClientView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ examId: string }> | { examId: string };
}

export default async function DedicatedExamProctoringPage(props: Props) {
  const supabase = await createClient();
  await supabase.auth.getUser();

  const resolvedParams = await props.params;
  const examId = resolvedParams.examId;

  const data = await getProctoringData(examId);

  // If exam doesn't exist among classified exams, return notFound()
  if (data.classifiedExams.length > 0) {
    const exists = data.classifiedExams.some((e) => e.id === examId);
    if (!exists) {
      notFound();
    }
  }

  return (
    <LiveProctoringClientView
      initialSessions={data.sessions}
      recentViolations={data.violations}
      exams={data.classifiedExams}
      initialInquiries={data.inquiries}
      focusedExamId={examId}
    />
  );
}
