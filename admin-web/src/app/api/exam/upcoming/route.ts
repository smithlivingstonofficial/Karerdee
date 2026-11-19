import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * GET /api/exam/upcoming
 * Public lightweight endpoint to fetch the upcoming or active exam metadata for the candidate portal.
 */
export async function GET() {
  try {
    const serverNow = new Date();
    const serverEpochMs = serverNow.getTime();

    // Query active or scheduled exams
    const { data: exams, error } = await supabaseAdmin
      .from("exams")
      .select("id, title, status, start_time, end_time, duration_minutes, passcode")
      .in("status", ["SCHEDULED", "ACTIVE", "ONGOING"])
      .order("start_time", { ascending: true })
      .limit(5);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!exams || exams.length === 0) {
      return NextResponse.json({
        success: true,
        upcomingExam: null,
        serverTimeIST: formatDateTime(serverNow, true, true),
        serverEpochMs,
      });
    }

    // Find the next upcoming exam whose end time has not passed
    const candidateExam = exams.find((e) => {
      const endEpoch = new Date(e.end_time).getTime();
      return serverEpochMs < endEpoch;
    }) || exams[0];

    const startTime = new Date(candidateExam.start_time);
    const endTime = new Date(candidateExam.end_time);
    const isStarted = serverEpochMs >= startTime.getTime();
    const secondsUntilStart = Math.max(0, Math.ceil((startTime.getTime() - serverEpochMs) / 1000));

    return NextResponse.json({
      success: true,
      upcomingExam: {
        id: candidateExam.id,
        title: candidateExam.title,
        status: candidateExam.status,
        startTime: startTime.toISOString(),
        startTimeIST: formatDateTime(startTime, false, true),
        endTime: endTime.toISOString(),
        endTimeIST: formatDateTime(endTime, false, true),
        durationMinutes: candidateExam.duration_minutes || 90,
        isStarted,
        secondsUntilStart,
      },
      serverTimeIST: formatDateTime(serverNow, true, true),
      serverEpochMs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch upcoming exam" }, { status: 500 });
  }
}
