import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface AnswerSubmissionItem {
  questionId: string;
  selectedOptionIds?: string[];
  subjectiveText?: string;
}

interface SubmitRequestBody {
  sessionId: string;
  answers: AnswerSubmissionItem[];
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization token." },
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
        { error: "Session token expired or tampered." },
        { status: 403 }
      );
    }

    const body: SubmitRequestBody = await req.json();
    const { sessionId, answers } = body;

    if (!sessionId || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Invalid submission payload format." },
        { status: 400 }
      );
    }

    if (decoded.sessionId !== sessionId) {
      return NextResponse.json(
        { error: "Session token mismatch." },
        { status: 403 }
      );
    }

    // 1. Fetch Session & Exam details
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        exam_id,
        status,
        exam:exams(
          id,
          title,
          enable_negative_marking
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: "Examination session not found." },
        { status: 404 }
      );
    }

    if (session.status === "SUBMITTED" || session.status === "DISQUALIFIED") {
      return NextResponse.json(
        { error: `Session already ${session.status.toLowerCase()}. Cannot resubmit.` },
        { status: 400 }
      );
    }

    const examData = (session as any).exam;
    const isNegativeMarking = Boolean(examData?.enable_negative_marking);

    // 2. Fetch all questions with correct options for auto-grading
    const { data: dbQuestions } = await supabaseAdmin
      .from("exam_questions")
      .select(`
        id,
        points,
        negative_points,
        question_type,
        options:question_options(
          id,
          is_correct
        )
      `)
      .eq("exam_id", session.exam_id);

    const questionsMap = new Map<string, any>();
    (dbQuestions || []).forEach((q: any) => {
      questionsMap.set(q.id, q);
    });

    // 3. Process answers and auto-grade MCQs
    let totalScore = 0;
    const submissionUpserts = [];

    for (const ans of answers) {
      const q = questionsMap.get(ans.questionId);
      let awardedMarks = 0;
      let isEvaluated = false;

      if (q && q.options && q.options.length > 0) {
        // MCQ Grading
        const correctOptIds = new Set<string>(
          q.options.filter((o: any) => o.is_correct).map((o: any) => o.id)
        );
        const selectedIds = ans.selectedOptionIds || [];

        if (selectedIds.length > 0) {
          const isAllCorrect =
            selectedIds.length === correctOptIds.size &&
            selectedIds.every((id: string) => correctOptIds.has(id));

          if (isAllCorrect) {
            awardedMarks = Number(q.points) || 1;
          } else {
            // Deduct negative points if applicable
            if (isNegativeMarking) {
              awardedMarks = -(Number(q.negative_points) || 0);
            }
          }
          isEvaluated = true;
          totalScore += awardedMarks;
        }
      }

      submissionUpserts.push({
        session_id: sessionId,
        question_id: ans.questionId,
        selected_option_ids: ans.selectedOptionIds || [],
        subjective_text: ans.subjectiveText || null,
        awarded_points: awardedMarks,
        is_auto_graded: isEvaluated,
      });
    }

    // 4. Batch upsert into submissions table
    if (submissionUpserts.length > 0) {
      const { error: subErr } = await supabaseAdmin
        .from("submissions")
        .upsert(submissionUpserts, { onConflict: "session_id,question_id" });

      if (subErr) {
        console.error("Failed to record submissions:", subErr);
      }
    }

    // 5. Finalize exam_sessions record
    const submittedAt = new Date().toISOString();
    const finalScore = Math.max(0, totalScore);

    const { error: sessionUpdateErr } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        status: "SUBMITTED",
        submitted_at: submittedAt,
        auto_score: finalScore,
      })
      .eq("id", sessionId);

    if (sessionUpdateErr) {
      console.error("Failed to finalize session status:", sessionUpdateErr);
      return NextResponse.json(
        { error: "Failed to record final session status." },
        { status: 500 }
      );
    }

    const referenceCode = `KARE-SUB-${sessionId.slice(0, 8).toUpperCase()}`;

    return NextResponse.json({
      success: true,
      sessionId,
      submittedAt,
      autoScore: finalScore,
      referenceCode,
      message: "Examination successfully submitted and auto-graded.",
    });
  } catch (err: any) {
    console.error("API Exam Submit Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during submission." },
      { status: 500 }
    );
  }
}

