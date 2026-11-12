import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { shuffleWithSeed } from "@/lib/utils";

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
      return NextResponse.json(
        { error: "Session token is required." },
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
        { status: 401 }
      );
    }

    const sessionId = querySessionId || decoded.sessionId;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID missing." },
        { status: 400 }
      );
    }

    // 1. Fetch Session
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, exam_id, student_id, hardware_fingerprint, status, strikes_count, extra_time_minutes, started_at")
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json(
        { error: "Exam session not found." },
        { status: 404 }
      );
    }

    if (session.status === "SUBMITTED" || session.status === "DISQUALIFIED") {
      return NextResponse.json(
        { error: `This examination attempt has already concluded (${session.status.toLowerCase()}).` },
        { status: 403 }
      );
    }

    // 2. Fetch Student with Department
    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .select(`
        id,
        full_name,
        roll_number,
        application_number,
        email,
        is_active,
        department:departments (
          id,
          code,
          name
        ),
        batch:batches (
          id,
          name,
          department:departments (
            id,
            code,
            name
          )
        )
      `)
      .eq("id", session.student_id)
      .single();

    if (studentErr || !student) {
      return NextResponse.json(
        { error: "Candidate record not found." },
        { status: 404 }
      );
    }

    // Resolve Department Code
    const studentDeptCode =
      (student as any)?.department?.code ||
      (student as any)?.batch?.department?.code ||
      "";

    // 3. Fetch Exam with timing & configuration
    const { data: exam, error: examErr } = await supabaseAdmin
      .from("exams")
      .select(`
        id,
        title,
        description,
        duration_minutes,
        max_strikes,
        randomize_questions,
        enable_negative_marking,
        status,
        start_time,
        end_time,
        config
      `)
      .eq("id", session.exam_id)
      .single();

    if (examErr || !exam) {
      return NextResponse.json(
        { error: "Associated exam not found." },
        { status: 404 }
      );
    }

    // 4. Resolve Applicable Sections for Candidate's Department
    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("exam_sections")
      .select("id, title, is_common, target_departments, default_points, default_negative_points, order_index")
      .eq("exam_id", exam.id)
      .order("order_index", { ascending: true });

    if (sectionsError) throw sectionsError;

    const cleanStudentDept = studentDeptCode?.trim()?.toUpperCase() || "";

    const applicableSections = (sections || []).filter((sec: any) => {
      if (sec.is_common) return true;
      if (!sec.target_departments || sec.target_departments.length === 0) return true;
      const validDepts = sec.target_departments
        .map((d: string) => d?.trim()?.toUpperCase())
        .filter(Boolean);
      if (validDepts.length === 0) return true;
      return cleanStudentDept ? validDepts.includes(cleanStudentDept) : true;
    });

    const applicableSectionIds = applicableSections.map((s: any) => s.id);

    // 5. Retrieve Questions & Options strictly for applicable sections
    let questionsQuery = supabaseAdmin
      .from("exam_questions")
      .select(`
        id,
        section_id,
        question_type,
        prompt,
        code_snippet,
        points,
        negative_points,
        order_index,
        rubric_criteria,
        question_options (
          id,
          option_text,
          order_index
        )
      `)
      .eq("exam_id", exam.id)
      .order("order_index", { ascending: true });

    if (applicableSectionIds.length > 0) {
      questionsQuery = questionsQuery.in("section_id", applicableSectionIds);
    }

    const { data: rawQuestions, error: questionsError } = await questionsQuery;
    if (questionsError) throw questionsError;

    // Map section IDs to is_common status
    const sectionCommonMap = new Map<string, boolean>();
    (sections || []).forEach((sec: any) => {
      sectionCommonMap.set(sec.id, Boolean(sec.is_common));
    });

    // Filter questions: Common core OR matching department
    const candidateQuestions = (rawQuestions || []).filter((q: any) => {
      const isCommonSection = sectionCommonMap.get(q.section_id) ?? false;
      if (isCommonSection) {
        return true;
      }

      const targetDept = q.rubric_criteria?.target_department?.trim().toUpperCase();
      if (!targetDept || targetDept === "GENERAL" || targetDept === "COMMON") {
        return true;
      }
      return cleanStudentDept ? targetDept === cleanStudentDept : false;
    });

    const examConfig = (exam.config as any) || {};
    const calculatorMode: "NONE" | "BASIC" | "SCIENTIFIC" = examConfig.calculator_mode || "NONE";
    const enableScratchpad: boolean = examConfig.enable_scratchpad ?? true;
    const enableQuestionFlagging: boolean = examConfig.enable_question_flagging ?? true;
    const strikeAction: string = examConfig.strike_action || "LOCK_WORKSTATION";
    const instructions: string = examConfig.instructions || exam.description || "";
    const shouldRandomizeOptions: boolean = Boolean(examConfig.randomize_options);
    const lockdownPolicy = examConfig.lockdown_policy || {
      blockKeyboardHooks: true,
      blockDisplayAffinity: true,
      blockMultipleMonitors: true,
      blockVirtualMachines: true,
      blockBlacklistedProcesses: true,
      lockHardwareFingerprint: false,
    };

    const serverNow = new Date();
    const serverEpochMs = serverNow.getTime();
    const endTime = exam.end_time ? new Date(exam.end_time) : new Date(serverEpochMs + 90 * 60000);
    const serverRemainingSeconds = Math.max(
      0,
      Math.min(
        (exam.duration_minutes + (session.extra_time_minutes || 0)) * 60,
        Math.floor((endTime.getTime() - serverEpochMs) / 1000)
      )
    );

    const sanitizedQuestions = candidateQuestions.map((q: any) => {
      let opts = (q.question_options || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((opt: any) => ({
          id: opt.id,
          text: opt.option_text,
        }));

      if (shouldRandomizeOptions) {
        opts = shuffleWithSeed(opts, `${session.id}_${q.id}_opts`);
      }

      return {
        id: q.id,
        sectionId: q.section_id,
        questionType: q.question_type,
        prompt: q.prompt,
        codeSnippet: q.code_snippet,
        points: Number(q.points),
        negativePoints: exam.enable_negative_marking ? (Number(q.negative_points) || 0) : 0,
        orderIndex: q.order_index,
        options: opts,
      };
    });

    // Deterministic Question Shuffling per candidate:
    // Shuffle strictly WITHIN each section so Part A questions stay in Part A, Part B in Part B,
    // and question sequence remains 100% stable across reloads for this session.
    let finalOrderedQuestions = sanitizedQuestions;
    if (exam.randomize_questions) {
      const questionsBySection = new Map<string, typeof sanitizedQuestions>();
      sanitizedQuestions.forEach((q) => {
        const list = questionsBySection.get(q.sectionId) || [];
        list.push(q);
        questionsBySection.set(q.sectionId, list);
      });

      const reassembled: typeof sanitizedQuestions = [];
      applicableSections.forEach((sec: any) => {
        const secList = questionsBySection.get(sec.id) || [];
        const shuffled = shuffleWithSeed(secList, `${session.id}_${sec.id}_qs`);
        reassembled.push(...shuffled);
      });

      finalOrderedQuestions = reassembled;
    }

    return NextResponse.json({
      success: true,
      token,
      sessionId: session.id,
      serverTime: serverNow.toISOString(),
      serverEpochMs,
      startTime: exam.start_time,
      endTime: exam.end_time,
      remainingSeconds: serverRemainingSeconds,
      candidate: {
        id: student.id,
        rollNumber: student.roll_number || student.application_number,
        applicationNumber: student.application_number,
        email: student.email,
        fullName: student.full_name,
        department: studentDeptCode,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        instructions,
        durationMinutes: exam.duration_minutes + (session.extra_time_minutes || 0),
        remainingSeconds: serverRemainingSeconds,
        serverTime: serverNow.toISOString(),
        serverEpochMs,
        startTime: exam.start_time,
        endTime: exam.end_time,
        maxStrikes: exam.max_strikes,
        currentStrikes: session.strikes_count || 0,
        status: session.status,
        enableNegativeMarking: Boolean(exam.enable_negative_marking),
        calculatorMode,
        enableScratchpad,
        enableQuestionFlagging,
        strikeAction,
        lockdownPolicy,
        sections: applicableSections,
        questions: finalOrderedQuestions,
      },
    });
  } catch (err: any) {
    console.error("Session fetch error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve session." },
      { status: 500 }
    );
  }
}

