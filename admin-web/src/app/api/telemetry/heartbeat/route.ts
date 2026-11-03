import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface HeartbeatRequestBody {
  sessionId: string;
  clientTimestamp?: string;
  hardwareFingerprint?: string;
  questionsAnsweredCount?: number;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization token" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret =
      process.env.EXAM_JWT_SECRET ||
      "safe_exam_development_jwt_secret_key_minimum_32_characters_long";

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return NextResponse.json(
        { error: "Session token expired or tampered" },
        { status: 403 }
      );
    }

    const body: HeartbeatRequestBody = await req.json();
    const { sessionId, hardwareFingerprint } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (decoded.sessionId !== sessionId) {
      return NextResponse.json(
        { error: "Session token mismatch" },
        { status: 403 }
      );
    }

    // 1. Fetch current session status with exam timing
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        status,
        strikes_count,
        extra_time_minutes,
        hardware_fingerprint,
        exam_id,
        exam:exams (
          start_time,
          end_time,
          duration_minutes
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json(
        { error: "Active examination session not found" },
        { status: 404 }
      );
    }

    const serverNow = new Date();
    const serverEpochMs = serverNow.getTime();
    const examData = (session as any)?.exam;
    let remainingSeconds = 0;
    let isExpired = false;

    if (examData?.end_time) {
      const endTime = new Date(examData.end_time);
      remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - serverEpochMs) / 1000));
      if (serverEpochMs > endTime.getTime() + 60 * 1000) {
        isExpired = true;
      }
    }

    // 2. Hardware verification if fingerprint supplied
    if (hardwareFingerprint && session.hardware_fingerprint) {
      const isUnbound =
        session.hardware_fingerprint === "UNBOUND_RESET_BY_ADMIN" ||
        session.hardware_fingerprint === "UNBOUND" ||
        session.hardware_fingerprint.startsWith("RELEASED_FOR_REBIND");

      if (!isUnbound && hardwareFingerprint.trim() !== session.hardware_fingerprint.trim()) {
        return NextResponse.json(
          {
            error: "Security Alert: Hardware fingerprint mismatch detected during heartbeat.",
            violation: "HARDWARE_MISMATCH",
            status: "LOCKED",
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      sessionStatus: isExpired ? "LOCKED" : session.status,
      isExpired,
      extraTimeMinutes: session.extra_time_minutes || 0,
      strikesCount: session.strikes_count || 0,
      serverTime: serverNow.toISOString(),
      serverEpochMs,
      serverCalculatedSecondsRemaining: remainingSeconds,
    });
  } catch (err: any) {
    console.error("Telemetry Heartbeat Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during heartbeat" },
      { status: 500 }
    );
  }
}

