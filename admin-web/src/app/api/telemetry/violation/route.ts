import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface ViolationRequestBody {
  sessionId: string;
  violationType: string;
  snapshotBase64?: string;
  metadata?: Record<string, any>;
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

    const body: ViolationRequestBody = await req.json();
    const { sessionId, violationType, snapshotBase64, metadata } = body;

    if (!sessionId || !violationType) {
      return NextResponse.json({ error: "Missing sessionId or violationType" }, { status: 400 });
    }

    let currentStrikes = 1;
    let isLocked = false;
    let snapshotUrl: string | undefined;

    // 1. Fetch current session & exam configuration
    const { data: session } = await supabaseAdmin
      .from("exam_sessions")
      .select(`
        id,
        status,
        strikes_count,
        exam_id,
        student_id,
        hardware_fingerprint,
        exams (
          id,
          title,
          max_strikes
        ),
        students (
          full_name,
          application_number,
          department:departments (code)
        )
      `)
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    const resolvedExamId = decoded.examId || session.exam_id || "general";

    // 2. Upload watermarked evidence snapshot to Supabase Storage if base64 provided
    if (snapshotBase64 && typeof snapshotBase64 === "string") {
      try {
        const cleanBase64 = snapshotBase64.includes(",")
          ? snapshotBase64.split(",")[1]
          : snapshotBase64;
        const buffer = Buffer.from(cleanBase64, "base64");
        const fileName = `${resolvedExamId}/${sessionId}/${Date.now()}.jpg`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from("exam-violations")
          .upload(fileName, buffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabaseAdmin.storage
            .from("exam-violations")
            .getPublicUrl(fileName);
          snapshotUrl = publicUrlData.publicUrl;
        } else if (uploadError) {
          console.warn("Storage snapshot upload error:", uploadError.message);
        }

        // Fallback: If publicUrl was not generated, persist Base64 Data URI directly so photo is 100% saved in DB
        if (!snapshotUrl && cleanBase64) {
          snapshotUrl = snapshotBase64.startsWith("data:")
            ? snapshotBase64
            : `data:image/jpeg;base64,${cleanBase64}`;
        }
      } catch (storageErr) {
        console.warn("Storage snapshot exception:", storageErr);
        if (snapshotBase64) {
          snapshotUrl = snapshotBase64;
        }
      }
    }

    function getSimpleEnglishWarning(type: string, reason?: string): string {
      switch (type) {
        case "HEAD_TURNED_AWAY":
        case "LOOKING_AWAY":
        case "SUSPICIOUS_HEAD_MOVEMENT":
          return "Candidate turned head / looking away from screen";
        case "MULTIPLE_FACES_DETECTED":
        case "MULTIPLE_FACES":
          return "Multiple people visible in camera";
        case "FACE_ABSENCE_EXCEEDED":
        case "NO_FACE_DETECTED":
        case "NO_FACE":
          return "No face visible in camera";
        case "CAMERA_STREAM_MUTED":
        case "CAMERA_OBSCURED":
          return "Camera view is covered or obscured";
        case "CLICKED_OUTSIDE_EXAM":
        case "WINDOW_FOCUS_LOST":
        case "WINDOW_UNFOCUSED":
          return "Clicked outside the examination page or switched windows";
        case "TAB_SWITCH_OR_MINIMIZE":
          return "Switched browser tab or minimized the exam window";
        case "FULLSCREEN_EXITED":
          return "Exited full-screen examination mode";
        case "CLIPBOARD_ACCESS_ATTEMPT":
          return "Attempted copy or paste shortcut";
        case "PROHIBITED_KEY_INPUT":
          return "Pressed restricted keyboard shortcut";
        case "NAVIGATION_INTERCEPTED":
          return "Attempted browser back/forward navigation";
        case "DEVTOOLS_ATTEMPT":
          return "Attempted to open browser inspection tools";
        case "PROCTOR_REQUESTED_SNAPSHOT":
          return "Invigilator requested camera photo";
        case "ROUTINE_SURVEILLANCE":
          return "Routine background camera verification";
        case "EXAM_COMMENCED_BASELINE":
        case "CANDIDATE_ENTRANCE_VERIFICATION":
          return "Candidate entrance identity photo";
        default:
          return reason || type.replace(/_/g, " ").toLowerCase();
      }
    }

    const isWebcamActivity =
      violationType === "HEAD_TURNED_AWAY" ||
      violationType === "LOOKING_AWAY" ||
      violationType === "SUSPICIOUS_HEAD_MOVEMENT" ||
      violationType === "MULTIPLE_FACES_DETECTED" ||
      violationType === "MULTIPLE_FACES" ||
      violationType === "NO_FACE_DETECTED" ||
      violationType === "FACE_ABSENCE_EXCEEDED" ||
      violationType === "NO_FACE" ||
      violationType === "CAMERA_STREAM_MUTED" ||
      violationType === "CAMERA_OBSCURED" ||
      metadata?.isWebcamActivity === true;

    const isAuditSnapshot =
      violationType === "PROCTOR_REQUESTED_SNAPSHOT" ||
      violationType === "ROUTINE_SURVEILLANCE" ||
      violationType === "SURVEILLANCE_SNAPSHOT" ||
      violationType === "EXAM_COMMENCED_BASELINE" ||
      violationType === "BASELINE_SURVEILLANCE" ||
      violationType === "CANDIDATE_ENTRANCE_VERIFICATION" ||
      violationType === "ENTRANCE_VERIFICATION" ||
      metadata?.isAudit === true ||
      metadata?.isSurveillance === true;

    // Automatic strike events: candidate clicked anywhere other than the exam page, tab switched, or exited fullscreen
    const isClickOutsideOrTabSwitch =
      violationType === "CLICKED_OUTSIDE_EXAM" ||
      violationType === "WINDOW_FOCUS_LOST" ||
      violationType === "WINDOW_UNFOCUSED" ||
      violationType === "TAB_SWITCH_OR_MINIMIZE" ||
      violationType === "FULLSCREEN_EXITED";

    let strikeIssued = false;
    const maxStrikes = (session as any).exams?.max_strikes || 3;

    // 3. Increment strike ONLY when clicking outside the exam page / tab switching.
    // Webcam activities (looking away, multiple people, no face) only capture photo for proctor review.
    if (isClickOutsideOrTabSwitch) {
      currentStrikes = (session.strikes_count || 0) + 1;
      isLocked = currentStrikes >= maxStrikes;
      strikeIssued = true;

      await supabaseAdmin
        .from("exam_sessions")
        .update({
          strikes_count: currentStrikes,
          status: isLocked ? "LOCKED" : "IN_PROGRESS",
        })
        .eq("id", sessionId);
    } else {
      currentStrikes = session.strikes_count || 0;
      isLocked = session.status === "LOCKED";
      strikeIssued = false;
    }

    // 4. Map violation_type to allowed PostgreSQL CHECK constraint values in violation_logs
    const ALLOWED_DB_TYPES = new Set([
      "NO_FACE",
      "MULTIPLE_FACES",
      "BLACK_LISTED_PROCESS",
      "MULTI_MONITOR_DETECTED",
      "SCREEN_CAPTURE_ATTEMPT",
      "SYSTEM_HOTKEY_ATTEMPT",
      "VM_DETECTED",
      "WINDOW_UNFOCUSED",
    ]);

    let dbViolationType = violationType;
    if (!ALLOWED_DB_TYPES.has(dbViolationType)) {
      if (
        violationType === "WINDOW_FOCUS_LOST" ||
        violationType === "CLICKED_OUTSIDE_EXAM" ||
        violationType === "TAB_SWITCH_OR_MINIMIZE" ||
        violationType === "FULLSCREEN_EXITED"
      ) {
        dbViolationType = "WINDOW_UNFOCUSED";
      } else if (
        violationType === "MULTIPLE_FACES_DETECTED" ||
        violationType === "MULTIPLE_FACES"
      ) {
        dbViolationType = "MULTIPLE_FACES";
      } else if (
        violationType.includes("FACE") ||
        violationType.includes("CAMERA") ||
        violationType.includes("HEAD")
      ) {
        dbViolationType = "NO_FACE";
      } else {
        dbViolationType = "WINDOW_UNFOCUSED";
      }
    }

    const simpleWarning = getSimpleEnglishWarning(violationType, metadata?.reason);

    const combinedMetadata = {
      ...(metadata || {}),
      actualViolationType: violationType,
      simpleWarning,
      isWebcamActivity,
      requiresProctorReview: isWebcamActivity,
      strikeIssued,
      isAudit: isAuditSnapshot,
      isSurveillance: isAuditSnapshot,
      recordedAt: new Date().toISOString(),
    };

    // 5. Record violation log with snapshot URL and strike number (0 for webcam activity)
    const { data: insertedViol, error: violInsertErr } = await supabaseAdmin
      .from("violation_logs")
      .insert({
        session_id: sessionId,
        violation_type: dbViolationType,
        strike_number: strikeIssued ? currentStrikes : 0,
        snapshot_url: snapshotUrl || null,
        metadata: combinedMetadata,
      })
      .select("id, created_at")
      .single();

    if (violInsertErr) {
      console.warn("Violation log insert error:", violInsertErr.message);
    }

    // 6. Broadcast to Live Proctoring Console via Supabase Realtime REST API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      try {
        await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                topic: "exam-proctor-broadcast",
                event: "violation_detected",
                payload: {
                  sessionId,
                  violationId: insertedViol?.id,
                  violationType,
                  simpleWarning,
                  isWebcamActivity,
                  requiresProctorReview: isWebcamActivity,
                  strikeIssued,
                  strikeNumber: strikeIssued ? currentStrikes : 0,
                  currentStrikes,
                  maxStrikes,
                  remainingStrikes: Math.max(0, maxStrikes - currentStrikes),
                  snapshotUrl: snapshotUrl || null,
                  isLocked,
                  isAuditSnapshot,
                  metadata: combinedMetadata,
                  recordedAt: insertedViol?.created_at || new Date().toISOString(),
                  student: {
                    fullName: (session as any).students?.full_name,
                    applicationNumber: (session as any).students?.application_number,
                    department: (session as any).students?.department?.code,
                  },
                },
              },
              {
                topic: `exam-telemetry:${resolvedExamId}`,
                event: "violation_detected",
                payload: {
                  sessionId,
                  violationId: insertedViol?.id,
                  violationType,
                  simpleWarning,
                  isWebcamActivity,
                  requiresProctorReview: isWebcamActivity,
                  strikeIssued,
                  strikeNumber: strikeIssued ? currentStrikes : 0,
                  currentStrikes,
                  maxStrikes,
                  remainingStrikes: Math.max(0, maxStrikes - currentStrikes),
                  snapshotUrl: snapshotUrl || null,
                  isLocked,
                  isAuditSnapshot,
                  metadata: combinedMetadata,
                  recordedAt: insertedViol?.created_at || new Date().toISOString(),
                  student: {
                    fullName: (session as any).students?.full_name,
                    applicationNumber: (session as any).students?.application_number,
                    department: (session as any).students?.department?.code,
                  },
                },
              },
            ],
          }),
        });
      } catch (broadcastErr) {
        console.warn("Realtime broadcast notice:", broadcastErr);
      }
    }

    return NextResponse.json({
      success: true,
      strikeIssued,
      currentStrikes,
      maxStrikes,
      remainingStrikes: Math.max(0, maxStrikes - currentStrikes),
      reason: simpleWarning,
      isLocked,
      snapshotUrl,
      recordedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Telemetry error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

