"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function broadcastProctorCommand(sessionId: string, command: string, message: string, proctorEmail: string = "proctor@kare.edu") {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;
  try {
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
              command,
              message,
              proctorEmail,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    }).catch(() => {});
  } catch {}
}

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

    // Realtime broadcast to freeze candidate workstation immediately
    broadcastProctorCommand(sessionId, "CMD_TERMINATE", reason, user.email || "proctor@kare.edu");

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
        strikes_count: 0,
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    // Realtime broadcast to unfreeze candidate workstation immediately
    broadcastProctorCommand(sessionId, "CMD_RESUME", "Workstation unlocked by invigilator.", user.email || "proctor@kare.edu");

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

    // Realtime broadcast to unfreeze candidate workstation immediately and clear strikes
    broadcastProctorCommand(
      sessionId,
      "CMD_RESUME",
      "Infraction strikes reset to 0 by invigilator.",
      user.email || "proctor@kare.edu"
    );

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

    // Realtime broadcast to unfreeze candidate workstation immediately
    broadcastProctorCommand(
      sessionId,
      "CMD_RESUME",
      "Late entry exception approved by invigilator.",
      user.email || "proctor@kare.edu"
    );

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

export async function issueStrikeAction(
  sessionId: string,
  reason: string = "Invigilator issued an infraction strike following activity review."
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { data: session, error: sessErr } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, strikes_count, exam_id, exams (max_strikes)")
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) return { error: "Session not found." };

    const maxStrikes = (session as any).exams?.max_strikes || 3;
    const newStrikes = (session.strikes_count || 0) + 1;
    const isLocked = newStrikes >= maxStrikes;

    const { error: updateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        strikes_count: newStrikes,
        status: isLocked ? "LOCKED" : "IN_PROGRESS",
      })
      .eq("id", sessionId);

    if (updateErr) throw updateErr;

    // Log the formal strike in violation_logs
    await supabaseAdmin.from("violation_logs").insert({
      session_id: sessionId,
      violation_type: "WINDOW_UNFOCUSED",
      strike_number: newStrikes,
      metadata: {
        action: "PROCTOR_ISSUED_STRIKE",
        reason,
        issuedBy: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    // Broadcast strike command to candidate sitting page
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
                command: isLocked ? "CMD_TERMINATE" : "CMD_STRIKE",
                message: reason,
                strikesCount: newStrikes,
                maxStrikes,
                remainingStrikes: Math.max(0, maxStrikes - newStrikes),
                isLocked,
                proctorEmail: user.email,
                timestamp: new Date().toISOString(),
              },
            },
          ],
        }),
      }).catch((err) => console.warn("Broadcast strike fetch error:", err));
    }

    revalidatePath("/proctoring");
    revalidatePath("/violations");
    return {
      success: true,
      newStrikes,
      isLocked,
      remainingStrikes: Math.max(0, maxStrikes - newStrikes),
    };
  } catch (err: any) {
    return { error: err.message || "Failed to issue strike." };
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

export async function sendProctorReplyAction(
  sessionId: string,
  replyText: string,
  replyToMessageId?: string
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    if (!sessionId || !replyText?.trim()) {
      return { error: "Session ID and reply message are required." };
    }

    const messageId = `reply_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const payload = {
      type: "PROCTOR_REPLY",
      messageId,
      replyToId: replyToMessageId || null,
      sender: "PROCTOR",
      proctorEmail: user.email,
      proctorName: "Invigilation Desk",
      message: replyText.trim(),
      timestamp: nowIso,
    };

    // 1. Record in proctor_actions for audit log
    const { error: insertErr } = await supabaseAdmin.from("proctor_actions").insert({
      session_id: sessionId,
      proctor_id: user.id,
      action_type: "WARN",
      reason: `[Invigilator Reply] ${replyText.trim().slice(0, 180)}`,
      action_payload: payload,
    });

    if (insertErr) throw insertErr;

    // 2. Broadcast via Supabase Realtime to candidate session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
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
              event: "proctor_chat_reply",
              payload,
            },
            {
              topic: `exam-session-${sessionId}`,
              event: "proctor_command",
              payload: {
                command: "CMD_ANNOUNCE",
                message: `💬 Invigilator: ${replyText.trim()}`,
                proctorEmail: user.email,
                timestamp: nowIso,
              },
            },
          ],
        }),
      }).catch((err) => console.warn("Broadcast reply fetch error:", err));
    }

    revalidatePath("/proctoring");
    return { success: true, payload };
  } catch (err: any) {
    return { error: err.message || "Failed to dispatch reply." };
  }
}

export async function markInquiryResolvedAction(actionId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const { data: action, error: fetchErr } = await supabaseAdmin
      .from("proctor_actions")
      .select("id, action_payload")
      .eq("id", actionId)
      .single();

    if (fetchErr || !action) return { error: "Inquiry record not found." };

    const updatedPayload = {
      ...(action.action_payload || {}),
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: user.email,
    };

    const { error: updateErr } = await supabaseAdmin
      .from("proctor_actions")
      .update({ action_payload: updatedPayload })
      .eq("id", actionId);

    if (updateErr) throw updateErr;

    revalidatePath("/proctoring");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to mark inquiry resolved." };
  }
}

export async function requestProctorSnapshotAction(sessionId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

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
                command: "CMD_REQUEST_SNAP",
                proctorEmail: user.email,
                timestamp: new Date().toISOString(),
              },
            },
          ],
        }),
      }).catch((err) => console.warn("Broadcast request snap error:", err));
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to dispatch webcam snapshot request." };
  }
}

export async function getCandidateDetailedLogAction(sessionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };
    if (!sessionId) return { error: "Session ID required" };

    // 1. Fetch exam session with student, department, and exam metadata
    const { data: session, error: sessErr } = await supabaseAdmin
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
          passcode,
          duration_minutes
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) throw sessErr || new Error("Exam session not found");

    // 2. Fetch all violation logs & forensic snapshots
    const { data: violations } = await supabaseAdmin
      .from("violation_logs")
      .select("id, session_id, violation_type, strike_number, snapshot_url, metadata, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    // 3. Fetch submissions count & recent question progress
    const { data: submissions } = await supabaseAdmin
      .from("submissions")
      .select("id, question_id, is_auto_graded, awarded_points, last_synced_at")
      .eq("session_id", sessionId)
      .order("last_synced_at", { ascending: false });

    // 4. Fetch proctor actions / administrative audits
    const { data: proctorActions } = await supabaseAdmin
      .from("proctor_actions")
      .select("id, session_id, proctor_id, action_type, reason, action_payload, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    return {
      success: true,
      session,
      violations: violations || [],
      submissions: submissions || [],
      proctorActions: proctorActions || [],
    };
  } catch (err: any) {
    return { error: err.message || "Failed to load candidate detailed log." };
  }
}





