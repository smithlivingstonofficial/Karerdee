import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime, formatTime } from "@/lib/date";

interface AuthRequestBody {
  email?: string;
  password?: string; // Application Number
  rollNumber?: string; // Backwards compatible with legacy desktop client
  applicationNumber?: string;
  examPasscode: string;
  hardwareFingerprint: string;
  clientVersion?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: AuthRequestBody = await req.json();
    const { examPasscode, clientVersion } = body;
    const hardwareFingerprint = (body.hardwareFingerprint || "BROWSER-SITTING-ENV").trim();

    const email = (body.email || body.rollNumber || "").trim();
    const candidatePassword = (body.password || body.applicationNumber || "").trim().toUpperCase();

    if (!email) {
      return NextResponse.json(
        { error: "Candidate Email ID is required." },
        { status: 400 }
      );
    }

    if (!candidatePassword) {
      return NextResponse.json(
        { error: "Candidate Password (Application ID) is required." },
        { status: 400 }
      );
    }

    if (!examPasscode?.trim()) {
      return NextResponse.json(
        { error: "Examination Security Passcode is required." },
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

    // 1. Verify active or scheduled exam with matching passcode
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
      .ilike("passcode", examPasscode.trim())
      .maybeSingle();

    if (examError || !exam) {
      return NextResponse.json(
        { error: "Invalid Examination Security Passcode. Please check the code provided on your hall ticket." },
        { status: 401 }
      );
    }

    const serverNow = new Date();
    const serverEpochMs = serverNow.getTime();
    const startTime = new Date(exam.start_time);
    const endTime = new Date(exam.end_time);
    const graceBufferMinutes = (exam.config as any)?.late_entry_buffer_minutes ?? 15;
    const graceCutoff = new Date(startTime.getTime() + graceBufferMinutes * 60 * 1000);

    // 1a. Strict Concluded Exam Window Check
    if (exam.status === "COMPLETED" || exam.status === "ARCHIVED" || serverEpochMs > endTime.getTime()) {
      return NextResponse.json(
        {
          error: `This examination has concluded. The scheduled exam window ended at ${formatDateTime(endTime)}. Access is strictly closed.`,
          code: "EXAM_CONCLUDED",
          serverTime: serverNow.toISOString(),
          serverEpochMs,
          endTime: endTime.toISOString(),
        },
        { status: 403 }
      );
    }

    // 1b. Strict Scheduled Start Window Check (No early entry before scheduled start)
    if (serverEpochMs < startTime.getTime()) {
      const minutesUntilStart = Math.ceil((startTime.getTime() - serverEpochMs) / 60000);
      return NextResponse.json(
        {
          error: `Examination has not commenced yet. Entry opens strictly at ${formatDateTime(startTime)}. Current server time: ${formatDateTime(serverNow)}.`,
          code: "EXAM_NOT_STARTED",
          serverTime: serverNow.toISOString(),
          serverEpochMs,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          minutesUntilStart,
        },
        { status: 403 }
      );
    }

    // 2. Look up Student by Email ID (with fallback to roll number or application number for backwards compatibility)
    let studentQuery = supabaseAdmin
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
      `);

    if (email.includes("@")) {
      studentQuery = studentQuery.ilike("email", email);
    } else {
      studentQuery = studentQuery.or(`email.ilike.${email},roll_number.ilike.${email},application_number.ilike.${email}`);
    }

    const { data: student, error: studentError } = await studentQuery.maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { error: `No registered candidate found with identifier "${email}". Please verify your email or contact the exam administrator.` },
        { status: 404 }
      );
    }

    // 3. Strict Password Verification: Password must match official Application ID (case-insensitive)
    const expectedAppId = (student.application_number || student.roll_number || "").trim().toUpperCase();
    if (!expectedAppId || candidatePassword !== expectedAppId) {
      return NextResponse.json(
        { error: "Incorrect password. Candidate password must match your official Application ID (printed on your hall ticket)." },
        { status: 401 }
      );
    }

    if (!student.is_active) {
      return NextResponse.json(
        { error: "Candidate registration is currently inactive. Contact the examination administration." },
        { status: 403 }
      );
    }

    // 3b. Strict Single Active Exam Policy (No Candidate in 2 Active Exams Simultaneously)
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
        const otherExam = (conflictingSession as any).exam;
        const otherEndTimeFormatted = formatDateTime(otherExam.end_time);
        return NextResponse.json(
          {
            error: `Concurrent Examination Restricted: You already have an unfinished, active session in "${otherExam.title}". Simultaneous multiple exam sittings are strictly prohibited.\n\nYou may only access this exam once your active sitting is submitted or its scheduled window concludes at ${otherEndTimeFormatted}.`,
            code: "CONCURRENT_EXAM_RESTRICTION",
            conflictingExamId: otherExam.id,
            conflictingExamTitle: otherExam.title,
            conflictingEndTime: otherExam.end_time,
          },
          { status: 403 }
        );
      }
    }

    // Resolve Department Code (directly from student.department or via batch.department)
    const studentDeptCode =
      (student as any)?.department?.code ||
      (student as any)?.batch?.department?.code ||
      "";

    // 3. Resolve Applicable Sections for this Candidate's Department
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

    // 4. Retrieve Questions & Options strictly for applicable sections
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

    // 4b. Strict Question Delivery by Section & Candidate's Department:
    // - Common Core section (is_common = true): ALL questions in this section are universal to all candidates
    // - Department Track section (is_common = false): questions strictly matching candidate's enrolled department
    const candidateQuestions = (rawQuestions || []).filter((q: any) => {
      const isCommonSection = sectionCommonMap.get(q.section_id) ?? false;
      if (isCommonSection) {
        return true;
      }

      const targetDept = q.rubric_criteria?.target_department?.trim().toUpperCase();
      if (!targetDept || targetDept === "GENERAL" || targetDept === "COMMON") {
        return true;
      }
      return targetDept === studentDeptCode.toUpperCase();
    });

    if (!candidateQuestions || candidateQuestions.length === 0) {
      return NextResponse.json(
        { error: `No examination questions configured for your department curriculum (${studentDeptCode || "General"}).` },
        { status: 404 }
      );
    }

    // 5. Hardware-Bound Session Verification & Late Entry Gatekeeping
    const isLateAttempt = serverEpochMs > graceCutoff.getTime();
    const delayMinutes = Math.round((serverEpochMs - startTime.getTime()) / 60000);

    let { data: session } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, hardware_fingerprint, status, strikes_count, extra_time_minutes")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .maybeSingle();

    // 5a. Late Entry Check: If arriving after grace cutoff, require explicit Proctor Authorization
    if (isLateAttempt) {
      if (!session || session.status === "LOCKED") {
        if (!session) {
          const { data: newSession, error: createError } = await supabaseAdmin
            .from("exam_sessions")
            .insert({
              exam_id: exam.id,
              student_id: student.id,
              hardware_fingerprint: hardwareFingerprint.trim(),
              client_version: clientVersion || "1.0.0",
              status: "LOCKED",
            })
            .select()
            .single();

          if (createError) throw createError;
          session = newSession;
        }

        // Send high-priority alert to Proctor Command Center
        await supabaseAdmin.from("violation_logs").insert({
          session_id: session!.id,
          violation_type: "WINDOW_UNFOCUSED",
          strike_number: 0,
          metadata: {
            event_type: "LATE_ENTRY_ATTEMPT",
            reason: `Candidate attempted login ${delayMinutes} minutes after scheduled start time (grace period of ${graceBufferMinutes} mins exceeded).`,
            delayMinutes,
            graceBufferMinutes,
            attemptedAt: serverNow.toISOString(),
            candidateName: student.full_name,
            rollNumber: student.roll_number || student.application_number,
            email: student.email,
            department: studentDeptCode,
            status: "PENDING_PROCTOR_REVIEW",
          },
        });

        return NextResponse.json(
          {
            error: `Late Entry Restricted: The examination entry grace period of ${graceBufferMinutes} minutes expired at ${formatTime(graceCutoff)}. You arrived +${delayMinutes} minutes after scheduled start time.\n\nYour attempt has been reported to the Chief Proctor. If an invigilator grants an exception, you will be able to retry and access the exam.`,
            code: "LATE_ENTRY_DENIED",
            serverTime: serverNow.toISOString(),
            serverEpochMs,
            startTime: startTime.toISOString(),
            graceCutoff: graceCutoff.toISOString(),
            delayMinutes,
            sessionId: session!.id,
            pendingProctorApproval: true,
          },
          { status: 403 }
        );
      }
    }

    if (session) {
      // Zero-Trust Hardware Binding Enforcement
      const isUnboundByAdmin =
        !session.hardware_fingerprint ||
        session.hardware_fingerprint === "UNBOUND_RESET_BY_ADMIN" ||
        session.hardware_fingerprint === "UNBOUND" ||
        session.hardware_fingerprint.startsWith("RELEASED_FOR_REBIND");

      if (!isUnboundByAdmin && session.hardware_fingerprint !== hardwareFingerprint.trim()) {
        return NextResponse.json(
          {
            error: "Security Alert: Hardware Mismatch. This session is locked to a different workstation.",
            violation: "HARDWARE_FINGERPRINT_MISMATCH",
          },
          { status: 403 }
        );
      }

      // If unbound by admin or first re-bind, latch to current device fingerprint and unlock session
      if (isUnboundByAdmin && hardwareFingerprint.trim()) {
        await supabaseAdmin
          .from("exam_sessions")
          .update({
            hardware_fingerprint: hardwareFingerprint.trim(),
            client_version: clientVersion || "1.0.0",
            status: "IN_PROGRESS",
          })
          .eq("id", session.id);
        session.hardware_fingerprint = hardwareFingerprint.trim();
        session.status = "IN_PROGRESS";
      }

      if (session.status === "SUBMITTED" || session.status === "DISQUALIFIED") {
        return NextResponse.json(
          { error: `This examination attempt has already been ${session.status.toLowerCase()}. Access denied.` },
          { status: 403 }
        );
      }

      if (session.status === "LOCKED") {
        return NextResponse.json(
          {
            error: "Workstation Locked: Your examination workstation has been frozen due to security infractions or pending authorization. Please contact the invigilator.",
            code: "WORKSTATION_LOCKED",
            sessionId: session.id,
          },
          { status: 403 }
        );
      }
    } else {
      // First-time hardware binding within allowable start window
      const { data: newSession, error: createError } = await supabaseAdmin
        .from("exam_sessions")
        .insert({
          exam_id: exam.id,
          student_id: student.id,
          hardware_fingerprint: hardwareFingerprint.trim(),
          client_version: clientVersion || "1.0.0",
          status: "IN_PROGRESS",
        })
        .select()
        .single();

      if (createError) throw createError;
      session = newSession;
    }

    if (!session) {
      return NextResponse.json(
        { error: "Failed to establish secure exam session." },
        { status: 500 }
      );
    }

    // 6. Exam Options & Tool Customization Propagation
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

    // Sanitize Questions (NEVER expose is_correct or internal answer keys to candidate client)
    const sanitizedQuestions = candidateQuestions.map((q: any) => {
      let opts = (q.question_options || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((opt: any) => ({
          id: opt.id,
          text: opt.option_text,
        }));

      // Respect Examination Option Shuffling setting
      if (shouldRandomizeOptions) {
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

    // Optional Question Shuffling per candidate
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

    // 7. Issue Cryptographically Signed Session JWT
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

    return NextResponse.json({
      success: true,
      token,
      sessionId: session.id,
      serverTime: serverNow.toISOString(),
      serverEpochMs,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
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
        serverEpochMs,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
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
    console.error("Secure Exam Auth Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during exam authorization." },
      { status: 500 }
    );
  }
}
