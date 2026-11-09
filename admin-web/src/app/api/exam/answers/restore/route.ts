import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/exam/answers/restore
 * Restores previously saved/synced answers for a session resume.
 * Called when candidate re-enters an exam via ticket or token.
 * Returns: { answers: { questionId: selectedOptionIds[] }[] }
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
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID missing." }, { status: 400 });
    }

    // Verify session belongs to this token
    if (decoded.sessionId !== sessionId) {
      return NextResponse.json({ error: "Session token mismatch." }, { status: 403 });
    }

    // Fetch saved answers from submissions table
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from("submissions")
      .select("question_id, selected_option_ids")
      .eq("session_id", sessionId);

    if (subErr) {
      console.error("Answer restore fetch error:", subErr);
      return NextResponse.json({ error: "Failed to retrieve saved answers." }, { status: 500 });
    }

    // Build answers map: questionId -> selectedOptionIds[]
    const answersMap: Record<string, string[]> = {};
    (submissions || []).forEach((sub: any) => {
      if (sub.selected_option_ids && Array.isArray(sub.selected_option_ids) && sub.selected_option_ids.length > 0) {
        answersMap[sub.question_id] = sub.selected_option_ids;
      }
    });

    return NextResponse.json({
      success: true,
      sessionId,
      answeredCount: Object.keys(answersMap).length,
      answers: answersMap,
    });
  } catch (err: any) {
    console.error("Answer restore error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}

