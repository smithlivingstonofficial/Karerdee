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
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.EXAM_JWT_SECRET || "safe_exam_development_jwt_secret_key_minimum_32_characters_long";

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return NextResponse.json({ error: "Session token expired or tampered" }, { status: 403 });
    }

    const body: SyncRequestBody = await req.json();
    const { sessionId, answers } = body;

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

