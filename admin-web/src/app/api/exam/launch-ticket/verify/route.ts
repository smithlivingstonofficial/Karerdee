import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/date";

interface VerifyRequestBody {
  ticket: string;
  hardwareFingerprint?: string;
  clientVersion?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: VerifyRequestBody = await req.json();
    const { ticket, clientVersion } = body;
    const hardwareFingerprint = (body.hardwareFingerprint || "STANDALONE-DIRECT-LAUNCH").trim();

    if (!ticket) {
      return NextResponse.json(
        { error: "Direct launch ticket is required." },
        { status: 400 }
      );
    }

    const jwtSecret = process.env.EXAM_JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        { error: "Server authentication configuration error (Missing JWT secret)." },
        { status: 500 }
      );
    }

    // 1. Verify cryptographic signature of the launch ticket
    let decoded: any;
    try {
      decoded = jwt.verify(ticket, jwtSecret);
    } catch (tokenErr: any) {
      return NextResponse.json(
        { error: "The exam launch ticket is invalid, altered, or has expired. Please contact the exam administrator." },
        { status: 401 }
      );
    }

    if (decoded.type !== "DIRECT_EXAM_LAUNCH" || !decoded.examId || !decoded.studentId) {
      return NextResponse.json(
        { error: "Invalid ticket type or malformed payload." },
        { status: 400 }
      );
    }

    const { examId, studentId } = decoded;

    // 2. Fetch Exam details
    const { data: exam, error: examError } = await supabaseAdmin
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
      .eq("id", examId)
      .maybeSingle();

    if (examError || !exam) {
      return NextResponse.json(
        { error: "The specified examination was not found or has been revoked." },
        { status: 404 }
      );
    }

    const serverNow = new Date();
    const serverEpochMs = serverNow.getTime();
    const startTime = new Date(exam.start_time);
    const endTime = new Date(exam.end_time);
    const graceBufferMinutes = (exam.config as any)?.late_entry_buffer_minutes ?? 15;
    const graceCutoff = new Date(startTime.getTime() + graceBufferMinutes * 60 * 1000);

    // 2a. Check if Exam is already concluded
    if (exam.status === "COMPLETED" || exam.status === "ARCHIVED" || serverEpochMs > endTime.getTime()) {
      return NextResponse.json(
        {
          error: `This examination has concluded. The scheduled exam window ended at ${formatDateTime(endTime, false, true)}. Access is strictly closed.`,
          code: "EXAM_CONCLUDED",
          serverTime: serverNow.toISOString(),
          serverTimeIST: formatDateTime(serverNow, true, true),
          serverEpochMs,
          endTime: endTime.toISOString(),
          endTimeIST: formatDateTime(endTime, false, true),
        },
        { status: 403 }
      );
    }

    // 2b. Scheduled Start Window Check (Entry cannot be earlier than scheduled start)
    if (serverEpochMs < startTime.getTime()) {
      const minutesUntilStart = Math.ceil((startTime.getTime() - serverEpochMs) / 60000);
      return NextResponse.json(
        {
          error: `Examination has not commenced yet. Entry opens strictly at ${formatDateTime(startTime, false, true)}. Current server time: ${formatDateTime(serverNow, true, true)}.`,
          code: "EXAM_NOT_STARTED",
          serverTime: serverNow.toISOString(),
          serverTimeIST: formatDateTime(serverNow, true, true),
          serverEpochMs,
          startTime: startTime.toISOString(),
          startTimeIST: formatDateTime(startTime, false, true),
          endTime: endTime.toISOString(),
          endTimeIST: formatDateTime(endTime, false, true),
          minutesUntilStart,
        },
        { status: 403 }
      );
    }

    // 3. Fetch Candidate details
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select(`
        id,
        auth_user_id,
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
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Candidate record not found in institutional database." },
        { status: 404 }
      );
    }

    if (!student.is_active) {
      return NextResponse.json(
        { error: "Candidate registration is currently inactive. Contact the examination administration." },
        { status: 403 }
      );
    }

    // 3a. Single Active Exam Policy (No Candidate in 2 Active Exams Simultaneously)
    const { data: otherActiveSessions } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        status,
        started_at,
        exam:exams (
          id,
          title,
          status,
          start_time,
          end_time
        )
      `)
      .eq("student_id", student.id)
      .neq("exam_id", exam.id)
      .in("status", ["IN_PROGRESS", "LOCKED", "PAUSED"]);

    if (otherActiveSessions && otherActiveSessions.length > 0) {
      const conflictingSession = otherActiveSessions.find((sess: any) => {
        const otherExam = sess.exam;
        if (!otherExam) return false;
        if (otherExam.status === "COMPLETED" || otherExam.status === "ARCHIVED") return false;
        const otherEndTime = new Date(otherExam.end_time).getTime();
        return serverEpochMs < otherEndTime;
      });

      if (conflictingSession) {
        const confExamTitle = (conflictingSession.exam as any)?.title || "another examination";
        return NextResponse.json(
          {
            error: `Candidate is currently participating in active session "${confExamTitle}". Institutional regulations prohibit simultaneous examination sittings.`,
            code: "CONCURRENT_EXAM_RESTRICTION",
          },
          { status: 403 }
        );
      }
    }

    // 4. Fetch or Initialize Exam Session
    const { data: existingSession, error: sessionFetchError } = await supabaseAdmin
      .from("exam_sessions")
      .select("*")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (sessionFetchError) {
      console.error("Session fetch error:", sessionFetchError);
    }

    let session = existingSession;

    if (session) {
      // Session Exists: Check terminal status
      if (session.status === "SUBMITTED") {
        return NextResponse.json(
          { error: "You have already submitted this examination. Re-entry is strictly prohibited." },
          { status: 403 }
        );
      }

      if (session.status === "DISQUALIFIED") {
        return NextResponse.json(
          { error: "You have been disqualified from this examination due to security/integrity violations." },
          { status: 403 }
        );
      }

      // Zero-Trust Hardware Binding Enforcement
      const isUnboundByAdmin =
        !session.hardware_fingerprint ||
        session.hardware_fingerprint === "UNBOUND_RESET_BY_ADMIN" ||
        session.hardware_fingerprint === "UNBOUND" ||
        session.hardware_fingerprint.startsWith("RELEASED_FOR_REBIND") ||
        session.hardware_fingerprint.startsWith("BROWSER-SITTING-ENV");

      if (!isUnboundByAdmin && session.hardware_fingerprint !== hardwareFingerprint.trim()) {
        return NextResponse.json(
          {
            error: "Security Alert: Hardware Mismatch. This examination session is locked to a different workstation.",
            code: "CONCURRENT_EXAM_RESTRICTION",
          },
          { status: 403 }
        );
      }

      // Resume session or bind current hardware fingerprint
      const { data: updatedSession, error: updateError } = await supabaseAdmin
        .from("exam_sessions")
        .update({
          hardware_fingerprint: hardwareFingerprint.trim(),
          client_version: clientVersion || "1.0.0",
          status: session.status === "PAUSED" ? "IN_PROGRESS" : session.status,
        })
        .eq("id", session.id)
        .select()
        .single();

      if (updateError) {
        console.error("Session update error in launch-ticket verify:", updateError);
      } else {
        session = updatedSession;
      }
    } else {
      // First Time Entry: Strict Late Arrival Check
      if (serverEpochMs > graceCutoff.getTime()) {
        const minutesLate = Math.floor((serverEpochMs - startTime.getTime()) / 60000);
        return NextResponse.json(
          {
            error: `Late entry restricted. Examination commenced ${minutesLate} minutes ago (Grace entry window was ${graceBufferMinutes} minutes). Please report to the Chief Proctor.`,
            code: "LATE_ENTRY_DENIED",
            serverTime: serverNow.toISOString(),
            serverTimeIST: formatDateTime(serverNow, true, true),
            serverEpochMs,
            startTime: startTime.toISOString(),
            startTimeIST: formatDateTime(startTime, false, true),
            graceCutoff: graceCutoff.toISOString(),
            graceCutoffIST: formatDateTime(graceCutoff, false, true),
          },
          { status: 403 }
        );
      }

      // Create new session
      const { data: newSession, error: insertError } = await supabaseAdmin
        .from("exam_sessions")
        .insert({
          exam_id: exam.id,
          student_id: student.id,
          hardware_fingerprint: hardwareFingerprint.trim(),
          client_version: clientVersion || "1.0.0",
          status: "IN_PROGRESS",
          started_at: serverNow.toISOString(),
          strikes_count: 0,
        })
        .select()
        .single();

      if (insertError || !newSession) {
        console.error("Session creation error in launch-ticket verify:", insertError);
        return NextResponse.json(
          { error: insertError?.message || "Failed to initialize candidate examination session." },
          { status: 500 }
        );
      }

      session = newSession;
    }

    // 5. Fetch Sections & Questions for candidate curriculum
    const studentDeptCode =
      (student.department as any)?.code ||
      (student.batch as any)?.department?.code ||
      "";

    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("exam_sections")
      .select("id, title, is_common, target_departments, default_points, default_negative_points, order_index")
      .eq("exam_id", exam.id)
      .order("order_index", { ascending: true });

    if (sectionsError) throw sectionsError;

    // Filter: Include if Common Core OR Candidate's Department is explicitly targeted
    const applicableSections = (sections || []).filter((sec: any) => {
      if (sec.is_common) return true;
      if (!sec.target_departments || sec.target_departments.length === 0) return true;
      return sec.target_departments.includes(studentDeptCode);
    });

    const applicableSectionIds = applicableSections.map((s: any) => s.id);

    // Retrieve Questions strictly for applicable sections
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
      .eq("exam_id", exam.id);

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

    // Filter questions by department track or common
    const candidateQuestions = (rawQuestions || []).filter((q: any) => {
      const isCommonSection = sectionCommonMap.get(q.section_id) ?? false;
      if (isCommonSection) return true;

      const targetDept = q.rubric_criteria?.target_department?.trim().toUpperCase();
      if (!targetDept || targetDept === "GENERAL" || targetDept === "COMMON") return true;
      return targetDept === studentDeptCode.toUpperCase();
    });

    // Sanitize questions (never leak is_correct)
    const sanitizedQuestions = candidateQuestions.map((q: any) => {
      let opts = (q.question_options || []).map((o: any) => ({
        id: o.id,
        text: o.option_text,
        orderIndex: o.order_index,
      }));

      if (exam.randomize_questions) {
        opts = [...opts].sort(() => Math.random() - 0.5);
      }

      return {
        id: q.id,
        sectionId: q.section_id,
        questionType: q.question_type,
        prompt: q.prompt,
        codeSnippet: q.code_snippet,
        points: q.points,
        negativePoints: exam.enable_negative_marking ? (q.negative_points || 0) : 0,
        orderIndex: q.order_index,
        options: opts,
      };
    });

    if (exam.randomize_questions) {
      sanitizedQuestions.sort(() => Math.random() - 0.5);
    }

    // Authoritative Server-Calculated Time Remaining (Seconds)
    const serverRemainingSeconds = Math.max(
      0,
      Math.min(
        (exam.duration_minutes + (session.extra_time_minutes || 0)) * 60,
        Math.floor((endTime.getTime() - serverEpochMs) / 1000)
      )
    );

    // Issue Cryptographically Signed Session JWT
    const token = jwt.sign(
      {
        sessionId: session.id,
        examId: exam.id,
        studentId: student.id,
        rollNumber: student.roll_number,
        hardwareFingerprint: session.hardware_fingerprint,
      },
      jwtSecret,
      { expiresIn: "6h" }
    );

    const examConfig = (exam.config as any) || {};
    const instructions = exam.description || examConfig.custom_instructions || "";
    const calculatorMode = examConfig.calculator_mode || "NONE";
    const enableScratchpad = examConfig.enable_scratchpad ?? true;
    const enableQuestionFlagging = examConfig.enable_question_flagging ?? true;
    const strikeAction = examConfig.strike_action || "AUTO_SUBMIT";
    const lockdownPolicy = {
      blockKeyboardHooks: true,
      blockBlacklistedProcesses: true,
      blockDisplayCapture: true,
      blockVirtualMachines: true,
      allowDevTools: false,
    };

    return NextResponse.json({
      success: true,
      token,
      sessionId: session.id,
      serverTime: serverNow.toISOString(),
      serverTimeIST: formatDateTime(serverNow, true, true),
      serverEpochMs,
      startTime: startTime.toISOString(),
      startTimeIST: formatDateTime(startTime, false, true),
      endTime: endTime.toISOString(),
      endTimeIST: formatDateTime(endTime, false, true),
      graceCutoff: graceCutoff.toISOString(),
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
        serverTimeIST: formatDateTime(serverNow, true, true),
        serverEpochMs,
        startTime: startTime.toISOString(),
        startTimeIST: formatDateTime(startTime, false, true),
        endTime: endTime.toISOString(),
        endTimeIST: formatDateTime(endTime, false, true),
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
        questions: sanitizedQuestions,
      },
    });
  } catch (err: any) {
    console.error("Direct Launch Ticket Verify Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify examination launch ticket." },
      { status: 500 }
    );
  }
}

