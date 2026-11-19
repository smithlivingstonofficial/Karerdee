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

    // 3. Atomically increment strike count on session (unless neutral on-demand proctor audit snap or routine surveillance)
    if (!isAuditSnapshot) {
      currentStrikes = (session.strikes_count || 0) + 1;
      const maxStrikes = (session as any).exams?.max_strikes || 3;
      isLocked = currentStrikes >= maxStrikes;

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
      if (violationType === "WINDOW_FOCUS_LOST" || violationType === "FULLSCREEN_EXITED") {
        dbViolationType = "WINDOW_UNFOCUSED";
      } else if (
        violationType.includes("FACE") ||
        violationType.includes("CAMERA")
      ) {
        dbViolationType = "NO_FACE";
      } else {
        // Routine surveillance, baseline photos, or other telemetries map to WINDOW_UNFOCUSED in DB with 0 strikes
        dbViolationType = "WINDOW_UNFOCUSED";
      }
    }

    const combinedMetadata = {
      ...(metadata || {}),
      actualViolationType: violationType,
      isAudit: isAuditSnapshot,
      isSurveillance: isAuditSnapshot,
      recordedAt: new Date().toISOString(),
    };

    // 5. Record violation log with snapshot URL
    const { data: insertedViol, error: violInsertErr } = await supabaseAdmin
      .from("violation_logs")
      .insert({
        session_id: sessionId,
        violation_type: dbViolationType,
        strike_number: isAuditSnapshot ? 0 : currentStrikes,
        snapshot_url: snapshotUrl || null,
        metadata: combinedMetadata,
      })
      .select("id, created_at")
      .single();

    if (violInsertErr) {
      console.warn("Violation log insert error:", violInsertErr.message);
    }

    // 5. Broadcast to Live Proctoring Console via Supabase Realtime REST API
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
                  strikeNumber: isAuditSnapshot ? 0 : currentStrikes,
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
                  strikeNumber: isAuditSnapshot ? 0 : currentStrikes,
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
      currentStrikes,
      isLocked,
      snapshotUrl,
      recordedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Telemetry error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

