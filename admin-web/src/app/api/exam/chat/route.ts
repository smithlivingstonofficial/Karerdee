import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface CandidateChatRequestBody {
  sessionId: string;
  token?: string;
  category?: string;
  message: string;
  questionNumber?: number | string;
}

export async function POST(req: NextRequest) {
  try {
    let body: CandidateChatRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { sessionId, category, message, questionNumber } = body;
    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (body.token) {
      token = body.token;
    }

    if (!token) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }

    const jwtSecret =
      process.env.EXAM_JWT_SECRET ||
      "safe_exam_development_jwt_secret_key_minimum_32_characters_long";

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return NextResponse.json({ error: "Session token expired or tampered" }, { status: 403 });
    }

    if (decoded.sessionId !== sessionId) {
      return NextResponse.json({ error: "Session token mismatch" }, { status: 403 });
    }

    // 1. Fetch Session and Student Details
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        exam_id,
        student_id,
        student:students (
          full_name,
          application_number,
          roll_number,
          department:departments (code, name)
        ),
        exam:exams (
          id,
          title
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    const student: any = session.student || {};
    const dept: any = student.department || {};
    const exam: any = session.exam || {};
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const payload = {
      type: "CANDIDATE_MESSAGE",
      messageId,
      sender: "CANDIDATE",
      sessionId,
      examId: session.exam_id,
      examTitle: exam.title || "Examination",
      candidateName: student.full_name || "Candidate",
      applicationNumber: student.application_number || student.roll_number || "",
      departmentCode: dept.code || "GENERAL",
      category: category || "GENERAL_DOUBT",
      questionNumber: questionNumber || null,
      message: message.trim(),
      status: "UNREAD",
      timestamp: nowIso,
    };

    // 2. Persist in proctor_actions
    const { error: insertErr } = await supabaseAdmin
      .from("proctor_actions")
      .insert({
        session_id: sessionId,
        action_type: "WARN",
        reason: `[Candidate Inquiry] ${category || "Doubt"}: ${message.trim().slice(0, 180)}`,
        action_payload: payload,
      });

    if (insertErr) {
      console.error("Failed to persist candidate chat inquiry:", insertErr);
    }

    // 3. Broadcast to Realtime channels
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
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
              // Broadcast to proctoring command desk
              {
                topic: "exam-proctor-broadcast",
                event: "candidate_inquiry",
                payload,
              },
              // Broadcast to session specific channel
              {
                topic: `exam-session-${sessionId}`,
                event: "candidate_chat_message",
                payload,
              },
            ],
          }),
        });
      } catch (broadcastErr: any) {
        console.warn("Realtime broadcast notice:", broadcastErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      messageId,
      timestamp: nowIso,
      payload,
    });
  } catch (err: any) {
    console.error("Candidate Chat API Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to deliver inquiry to invigilation desk." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const queryToken = searchParams.get("token");

    const authHeader = req.headers.get("authorization");
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (queryToken) {
      token = queryToken;
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
    }

    // Fetch all proctor_actions for this session that are chat messages
    const { data: actions, error } = await supabaseAdmin
      .from("proctor_actions")
      .select("id, action_payload, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const messages = (actions || [])
      .filter((a) => {
        const type = a.action_payload?.type;
        return type === "CANDIDATE_MESSAGE" || type === "PROCTOR_REPLY";
      })
      .map((a) => ({
        id: a.id,
        ...a.action_payload,
        createdAt: a.created_at,
      }));

    return NextResponse.json({
      success: true,
      sessionId,
      messages,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
