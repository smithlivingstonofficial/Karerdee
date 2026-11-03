import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ViolationsClientView, ViolationRecord } from "./components/ViolationsClientView";

export const dynamic = "force-dynamic";

export default async function ViolationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let violations: ViolationRecord[] = [];

  try {
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
          hardware_fingerprint,
          student:students (
            id,
            full_name,
            application_number,
            email,
            department:departments (code)
          ),
          exam:exams (title)
        )
      `)
      .order("created_at", { ascending: false });

    if (rawViolations) {
      violations = rawViolations.map((v: any) => ({
        id: v.id,
        sessionId: v.session_id,
        candidateName: v.session?.student?.full_name || "Unknown Candidate",
        applicationNumber: v.session?.student?.application_number || "",
        email: v.session?.student?.email || "",
        departmentCode: v.session?.student?.department?.code || "GENERAL",
        examTitle: v.session?.exam?.title || "Examination",
        violationType: v.violation_type || "Integrity Violation",
        strikeNumber: v.strike_number || 1,
        hardwareFingerprint: v.session?.hardware_fingerprint || "UNBOUND",
        snapshotUrl: v.snapshot_url || null,
        metadata: v.metadata || {},
        createdAt: v.created_at,
      }));
    }
  } catch (err) {
    console.warn("Violations query exception:", err);
  }

  return <ViolationsClientView violations={violations} />;
}

