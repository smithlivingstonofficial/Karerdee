import { createClient } from "@/lib/supabase/server";
import { getProctoringData } from "./data";
import { LiveProctoringClientView } from "./components/LiveProctoringClientView";

export const dynamic = "force-dynamic";

export default async function LiveProctoringPage() {
  const supabase = await createClient();
  await supabase.auth.getUser();

  const data = await getProctoringData();

  return (
    <LiveProctoringClientView
      initialSessions={data.sessions}
      recentViolations={data.violations}
      exams={data.classifiedExams}
      initialInquiries={data.inquiries}
    />
  );
}
