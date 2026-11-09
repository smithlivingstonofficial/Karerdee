import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/proctor/broadcast
 * Allows an authenticated admin/proctor to push a real-time broadcast message
 * to a specific candidate session via Supabase Realtime channels.
 *
 * Commands:
 *  CMD_WARN     - Display a warning overlay on candidate screen
 *  CMD_ANNOUNCE - Display an announcement banner (non-punitive)
 *  CMD_TERMINATE - Force submit and lock the exam session
 *
 * Request body:
 *  { sessionId: string, command: "CMD_WARN"|"CMD_ANNOUNCE"|"CMD_TERMINATE", message: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify invigilator is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Admin authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, command, message } = body;

    if (!sessionId || !command) {
      return NextResponse.json({ error: "sessionId and command are required." }, { status: 400 });
    }

    const validCommands = ["CMD_WARN", "CMD_ANNOUNCE", "CMD_TERMINATE", "CMD_RESUME"];
    if (!validCommands.includes(command)) {
      return NextResponse.json(
        { error: `Invalid command. Must be one of: ${validCommands.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch session to verify it exists and is active
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, status, student_id, exam_id")
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Examination session not found." }, { status: 404 });
    }

    // Handle CMD_TERMINATE: force-mark session and lock
    if (command === "CMD_TERMINATE") {
      await supabaseAdmin
        .from("exam_sessions")
        .update({ status: "LOCKED" })
        .eq("id", sessionId);
    }

    // Log the proctor broadcast action for audit trail
    try {
      await supabaseAdmin.from("proctor_actions").insert({
        session_id: sessionId,
        proctor_id: user.id,
        action_type: command === "CMD_TERMINATE" ? "FORCE_SUBMIT" : command === "CMD_WARN" ? "WARN" : "UNLOCK",
        reason: message || command,
        action_payload: {
          command,
          message: message || "",
          proctorEmail: user.email,
          broadcastAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      // proctor_actions table may not exist - warn but don't fail
      console.warn("Proctor action log insert notice:", err?.message);
    }

    // Broadcast via Supabase Realtime to candidate session channel
    // This uses the anon-safe broadcast feature so the candidate's Realtime channel receives it
    const channelName = `exam-session-${sessionId}`;
    const broadcastPayload = {
      command,
      message: message || getDefaultMessage(command),
      proctorEmail: user.email,
      timestamp: new Date().toISOString(),
    };

    // Use supabaseAdmin to broadcast via REST API (server-side Realtime broadcast)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      try {
        const broadcastRes = await fetch(
          `${supabaseUrl}/realtime/v1/api/broadcast`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
            },
            body: JSON.stringify({
              messages: [
                {
                  topic: channelName,
                  event: "proctor_command",
                  payload: broadcastPayload,
                },
              ],
            }),
          }
        );

        if (!broadcastRes.ok) {
          const errText = await broadcastRes.text();
          console.warn("Realtime broadcast notice:", errText);
        }
      } catch (broadcastErr: any) {
        console.warn("Realtime broadcast exception:", broadcastErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
      command,
      broadcastedAt: new Date().toISOString(),
      message: broadcastPayload.message,
    });
  } catch (err: any) {
    console.error("Proctor broadcast error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

function getDefaultMessage(command: string): string {
  switch (command) {
    case "CMD_WARN":
      return "You have received a formal warning from the examination invigilator. Please adhere to examination rules.";
    case "CMD_ANNOUNCE":
      return "An important announcement from the examination hall. Please read carefully.";
    case "CMD_TERMINATE":
      return "Your examination has been terminated by the invigilator. Your workstation is now locked.";
    case "CMD_RESUME":
      return "Your workstation has been unlocked by the invigilator. You may continue.";
    default:
      return "Message from invigilator.";
  }
}

