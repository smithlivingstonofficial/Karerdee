import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/exam/status
 * Quick lightweight exam status ping for the sitting page.
 * Returns current session status, time remaining, strikes, extra time.
 * Used as a fallback when Realtime channel is unavailable.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const queryToken = req.nextUrl.searchParams.get("token");
    const querySessionId = req.nextUrl.searchParams.get("sessionId");

    let token = queryToken;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return NextResponse.json({ error: "Session token is required." }, { status: 401 });
    }

    const jwtSecret =
      process.env.EXAM_JWT_SECRET ||
      "safe_exam_development_jwt_secret_key_minimum_32_characters_long";

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return NextResponse.json({ error: "Session token expired or tampered." }, { status: 401 });
    }

    const sessionId = querySessionId || decoded.sessionId;
    if (!sessionId || decoded.sessionId !== sessionId) {
      return NextResponse.json({ error: "Session ID mismatch." }, { status: 403 });
    }

    const { data: session, error: sessErr } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        status,
        strikes_count,
        extra_time_minutes,
        exam:exams (
          id,
          status,
          end_time,
          duration_minutes
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const serverNow = new Date();
    const serverEpochMs = serverNow.getTime();
    const examData = (session as any).exam;
    let serverCalculatedSecondsRemaining = 0;

    if (examData?.end_time) {
      const endTime = new Date(examData.end_time);
      serverCalculatedSecondsRemaining = Math.max(
        0,
        Math.floor((endTime.getTime() + (session.extra_time_minutes || 0) * 60000 - serverEpochMs) / 1000)
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      sessionStatus: session.status,
      strikesCount: session.strikes_count || 0,
      extraTimeMinutes: session.extra_time_minutes || 0,
      serverTime: serverNow.toISOString(),
      serverEpochMs,
      serverCalculatedSecondsRemaining,
      examStatus: examData?.status || "UNKNOWN",
    });
  } catch (err: any) {
    console.error("Exam status fetch error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

