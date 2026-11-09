"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function lockWorkstationAction(sessionId: string, reason: string = "Manual freeze by examination invigilator") {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        status: "LOCKED",
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    // Log the manual lock as an administrative audit event
    await supabaseAdmin.from("violation_logs").insert({
      session_id: sessionId,
      violation_type: "WINDOW_UNFOCUSED",
      strike_number: 99,
      metadata: { action: "PROCTOR_FREEZE", reason, initiatedBy: user.email, timestamp: new Date().toISOString() },
    });

    revalidatePath("/proctoring");
    revalidatePath("/violations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to lock workstation." };
  }
}

export async function unlockWorkstationAction(sessionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        status: "IN_PROGRESS",
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    revalidatePath("/proctoring");
    revalidatePath("/violations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to unlock workstation." };
  }
}

export async function addExtraTimeAction(sessionId: string, additionalMinutes: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    if (!additionalMinutes || additionalMinutes <= 0) {
      return { error: "Extra time must be greater than 0 minutes." };
    }

    const { data: session, error: fetchErr } = await supabaseAdmin
      .from("exam_sessions")
      .select("extra_time_minutes")
      .eq("id", sessionId)
      .single();

    if (fetchErr || !session) throw fetchErr || new Error("Session not found");

    const newExtra = (session.extra_time_minutes || 0) + additionalMinutes;

    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        extra_time_minutes: newExtra,
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    revalidatePath("/proctoring");
    return { success: true, totalExtraMinutes: newExtra };
  } catch (err: any) {
    return { error: err.message || "Failed to add compensatory time." };
  }
}

export async function resetStrikesAction(sessionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        strikes_count: 0,
        status: "IN_PROGRESS",
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    // Log the strike reset as an administrative audit event
    await supabaseAdmin.from("violation_logs").insert({
      session_id: sessionId,
      violation_type: "WINDOW_UNFOCUSED",
      strike_number: 0,
      metadata: {
        action: "PROCTOR_RESET_STRIKES",
        reason: "Invigilator manually cleared infraction strikes counter back to 0.",
        initiatedBy: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    revalidatePath("/proctoring");
    revalidatePath("/violations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to reset strike counter." };
  }
}

export async function resetCandidateWorkstationBindingAction(studentId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    // Reset hardware fingerprint across any active sessions for this student
    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        hardware_fingerprint: "UNBOUND_RESET_BY_ADMIN",
        status: "IN_PROGRESS",
      })
      .eq("student_id", studentId)
      .in("status", ["IN_PROGRESS", "LOCKED", "PAUSED"]);

    if (updateErr) throw updateErr;

    revalidatePath("/proctoring");
    revalidatePath("/students");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to reset workstation hardware binding." };
  }
}

export async function grantLateEntryAction(sessionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        status: "IN_PROGRESS",
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    // Log proctor action audit
    await supabaseAdmin.from("proctor_actions").insert({
      session_id: sessionId,
      proctor_id: user.id,
      action_type: "UNLOCK",
      reason: "Late entry exception approved by invigilator",
      action_payload: { approvedAt: new Date().toISOString(), proctorEmail: user.email },
    });

    revalidatePath("/proctoring");
    revalidatePath("/violations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to grant late entry." };
  }
}

export async function denyLateEntryAction(sessionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        status: "DISQUALIFIED",
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    // Log proctor action audit
    await supabaseAdmin.from("proctor_actions").insert({
      session_id: sessionId,
      proctor_id: user.id,
      action_type: "FORCE_SUBMIT",
      reason: "Late entry denied by invigilator (exceeded grace period)",
      action_payload: { deniedAt: new Date().toISOString(), proctorEmail: user.email },
    });

    revalidatePath("/proctoring");
    revalidatePath("/violations");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to deny late entry." };
  }
}

export async function sendProctorWarningAction(sessionId: string, message: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const warningText = (message || "Candidate Warning: Please look at the examination screen and maintain exam integrity.").trim();

    // Log the formal warning in violation_logs for the candidate
    await supabaseAdmin.from("violation_logs").insert({
      session_id: sessionId,
      violation_type: "PROCTOR_WARNING",
      strike_number: 0,
      metadata: {
        action: "PROCTOR_DIRECT_WARNING",
        message: warningText,
        issuedBy: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    // Broadcast in real-time to candidate sitting page
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: `exam-session-${sessionId}`,
              event: "proctor_command",
              payload: {
                command: "CMD_WARN",
                message: warningText,
                proctorEmail: user.email,
                timestamp: new Date().toISOString(),
              },
            },
          ],
        }),
      }).catch((err) => console.warn("Broadcast warning fetch error:", err));
    }

    revalidatePath("/proctoring");
    return { success: true, message: warningText };
  } catch (err: any) {
    return { error: err.message || "Failed to issue proctor warning." };
  }
}

export async function sendProctorAnnouncementAction(sessionId: string, message: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const announceText = (message || "Examination Hall Notice: Please check your screen.").trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: `exam-session-${sessionId}`,
              event: "proctor_command",
              payload: {
                command: "CMD_ANNOUNCE",
                message: announceText,
                proctorEmail: user.email,
                timestamp: new Date().toISOString(),
              },
            },
          ],
        }),
      }).catch((err) => console.warn("Broadcast announcement fetch error:", err));
    }

    return { success: true, message: announceText };
  } catch (err: any) {
    return { error: err.message || "Failed to dispatch announcement." };
  }
}



