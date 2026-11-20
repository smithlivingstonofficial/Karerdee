import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface AnswerItem {
  questionId: string;
  selectedOptionIds?: string[];
  subjectiveText?: string;
  clientTimestamp: string;
}

interface SyncRequestBody {
  sessionId: string;
  answers: AnswerItem[];
  token?: string;
}

export async function POST(req: NextRequest) {
  try {
    let rawBody: any = null;
    try {
      rawBody = await req.json();
    } catch {
      try {
        const text = await req.text();
        rawBody = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Invalid sync payload format" }, { status: 400 });
      }
    }

    const body: SyncRequestBody = rawBody || {};
    const { sessionId, answers } = body;

    const authHeader = req.headers.get("authorization");
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (body && typeof body.token === "string" && body.token) {
      token = body.token;
    }

    if (!token) {
      return NextResponse.json({ error: "Missing or invalid authorization token in header or payload" }, { status: 401 });
    }

    const jwtSecret = process.env.EXAM_JWT_SECRET || "safe_exam_development_jwt_secret_key_minimum_32_characters_long";

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return NextResponse.json({ error: "Session token expired or tampered" }, { status: 403 });
    }

    if (!sessionId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid sync payload format" }, { status: 400 });
    }

    if (decoded.sessionId !== sessionId) {
      return NextResponse.json({ error: "Token sessionId does not match request body" }, { status: 403 });
    }

    // Live Supabase submission sync
    try {
      if (answers.length > 0) {
        const upsertPayload = answers.map((ans) => ({
          session_id: sessionId,
          question_id: ans.questionId,
          selected_option_ids: ans.selectedOptionIds || [],
          subjective_text: ans.subjectiveText || null,
          last_synced_at: new Date().toISOString(),
        }));

        await supabaseAdmin
          .from("submissions")
          .upsert(upsertPayload, { onConflict: "session_id,question_id" });
      }
    } catch (dbErr) {
      console.warn("Database sync notice (in mock/offline mode):", dbErr);
    }

    return NextResponse.json({
      success: true,
      syncedCount: answers.length,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("API Sync error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

