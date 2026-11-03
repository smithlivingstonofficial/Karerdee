import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { examId, studentId } = body;

    if (!examId || !studentId) {
      return NextResponse.json(
        { error: "examId and studentId are required to generate a direct launch ticket." },
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

    // 1. Verify Exam exists
    const { data: exam, error: examError } = await supabaseAdmin
      .from("exams")
      .select("id, title, status, start_time, end_time")
      .eq("id", examId)
      .maybeSingle();

    if (examError || !exam) {
      return NextResponse.json(
        { error: "Examination not found." },
        { status: 404 }
      );
    }

    // 2. Verify Student exists
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, full_name, roll_number, application_number, email, is_active")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Registered candidate not found." },
        { status: 404 }
      );
    }

    // 3. Issue cryptographically signed one-time direct launch ticket
    // Token is valid until the end of the examination window + 2 hours
    const endTime = new Date(exam.end_time);
    const now = new Date();
    const secondsUntilEnd = Math.max(3600, Math.floor((endTime.getTime() - now.getTime()) / 1000) + 7200);

    const ticket = jwt.sign(
      {
        type: "DIRECT_EXAM_LAUNCH",
        examId: exam.id,
        studentId: student.id,
        applicationNumber: student.application_number || student.roll_number,
        email: student.email,
        fullName: student.full_name,
      },
      jwtSecret,
      { expiresIn: secondsUntilEnd }
    );

    return NextResponse.json({
      success: true,
      ticket,
      candidate: {
        id: student.id,
        fullName: student.full_name,
        applicationNumber: student.application_number || student.roll_number,
        email: student.email,
      },
      exam: {
        id: exam.id,
        title: exam.title,
      },
    });
  } catch (err: any) {
    console.error("Generate Launch Ticket Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate candidate launch ticket." },
      { status: 500 }
    );
  }
}

