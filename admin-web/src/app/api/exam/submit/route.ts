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
  token?: string;
  submissionReason?: string;
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
        return NextResponse.json(
          { error: "Invalid submission payload format." },
          { status: 400 }
        );
      }
    }

    const body: SubmitRequestBody = rawBody || {};
    const { sessionId, answers } = body;

    const authHeader = req.headers.get("authorization");
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (body && typeof body.token === "string" && body.token) {
      token = body.token;
    }

    if (!token) {
      return NextResponse.json(
        { error: "Missing or invalid authorization token in header or payload." },
        { status: 401 }
      );
    }

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
        submitted_at,
        auto_score,
        final_score,
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

    // Idempotent submission: if already submitted, return verified success
    if (session.status === "SUBMITTED") {
      const referenceCode = `KARE-SUB-${sessionId.slice(0, 8).toUpperCase()}`;
      return NextResponse.json({
        success: true,
        sessionId,
        submittedAt: session.submitted_at || new Date().toISOString(),
        autoScore: session.auto_score ?? session.final_score ?? 0,
        referenceCode,
        message: "Examination session was already finalized and submitted.",
        alreadySubmitted: true,
      });
    }

    if (session.status === "DISQUALIFIED") {
      return NextResponse.json(
        { error: "Session disqualified. Cannot submit." },
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
            awardedMarks = 1; // Standardized: Exactly 1 mark per correct question
          } else {
            // Deduct negative points if applicable
            if (isNegativeMarking) {
              awardedMarks = -(Number(q.negative_points) || 0.25);
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

    // 6. Record Forensic Audit entry if auto-submitted by watchdog / schedule / exit
    const reason = body.submissionReason || "NORMAL";
    if (reason === "FORCE_EXIT" || reason === "WINDOW_PAGEHIDE" || reason === "WINDOW_BEFOREUNLOAD") {
      await supabaseAdmin.from("violation_logs").insert({
        session_id: sessionId,
        violation_type: "WINDOW_UNFOCUSED",
        strike_number: (session as any)?.strikes_count || 1,
        metadata: {
          exitTrigger: reason,
          incident: "FORCEFUL_EXIT_AUTO_SUBMIT",
          description: "Candidate attempted forceful browser exit or window closure. Examination progress automatically secured, evaluated, and finalized.",
          answeredQuestionsCount: answers.length,
          submittedAt,
        },
      });

      await supabaseAdmin.from("proctor_actions").insert({
        session_id: sessionId,
        action_type: "FORCE_SUBMIT",
        reason: "Workstation forceful exit watchdog triggered automatic submission.",
      });
    } else if (reason === "SCHEDULE_EXPIRED" || reason === "DURATION_EXPIRED") {
      await supabaseAdmin.from("proctor_actions").insert({
        session_id: sessionId,
        action_type: "FORCE_SUBMIT",
        reason: `Examination concluded automatically due to ${reason === "SCHEDULE_EXPIRED" ? "exam schedule end-time" : "allotted duration expiry"}. Candidate responses secured and finalized.`,
      });
    }

    const referenceCode = `KARE-SUB-${sessionId.slice(0, 8).toUpperCase()}`;

    return NextResponse.json({
      success: true,
      sessionId,
      submittedAt,
      autoScore: finalScore,
      referenceCode,
      submissionReason: reason,
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

