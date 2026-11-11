"use server";

import jwt from "jsonwebtoken";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CandidateLookupResult {
  success: boolean;
  error?: string;
  candidate?: {
    id: string;
    fullName: string;
    applicationNumber: string;
    email: string;
    departmentCode: string;
    departmentName?: string;
  };
  exam?: {
    id: string;
    title: string;
    courseCode: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    passcode: string;
    status: string;
  };
  launchUrl?: string;
  protocolUrl?: string;
  webSittingUrl?: string;
}

export async function lookupCandidateExam(
  emailInput: string,
  appNoInput: string
): Promise<CandidateLookupResult> {
  const email = (emailInput || "").trim().toLowerCase();
  const appNo = (appNoInput || "").trim().toUpperCase();

  if (!email || !appNo) {
    return {
      success: false,
      error: "Both Registered Email ID and Application Number (Password) are required.",
    };
  }

  try {
    // 1. Find Candidate strictly by registered institutional email
    const { data: students, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, full_name, roll_number, application_number, email, department_id, departments(code, name)")
      .ilike("email", email)
      .limit(1);

    if (studentError) {
      console.error("Student lookup error:", studentError);
      return { success: false, error: "Database error while verifying candidate credentials." };
    }

    if (!students || students.length === 0) {
      return {
        success: false,
        error: "Invalid Email ID or Application Number. Please verify your credentials.",
      };
    }

    const student = students[0];
    const registeredAppNo = (student.application_number || "").trim().toUpperCase();
    const registeredRollNo = (student.roll_number || "").trim().toUpperCase();

    // 2. Validate Application Number as the candidate's secret credential
    if (appNo !== registeredAppNo && appNo !== registeredRollNo) {
      return {
        success: false,
        error: "Invalid Email ID or Application Number. Please verify your credentials.",
      };
    }

    const dept = student.departments as any;
    const departmentCode = dept?.code || "GEN";
    const departmentName = dept?.name || "General Curriculum";

    // 3. Find eligible examination (ACTIVE or SCHEDULED)
    const { data: exams, error: examError } = await supabaseAdmin
      .from("exams")
      .select("id, title, course_code, duration_minutes, passcode, status, start_time, end_time")
      .in("status", ["ACTIVE", "SCHEDULED"])
      .order("status", { ascending: true }) // ACTIVE first
      .order("start_time", { ascending: false })
      .limit(1);

    if (examError) {
      console.error("Exam lookup error:", examError);
      return { success: false, error: "Database error while retrieving examination schedules." };
    }

    if (!exams || exams.length === 0) {
      return {
        success: false,
        error: "There are currently no active or scheduled examinations available for your candidacy.",
      };
    }

    const exam = exams[0];

    // 4. Generate cryptographically signed JWT direct launch ticket
    const jwtSecret = process.env.EXAM_JWT_SECRET;
    if (!jwtSecret) {
      return {
        success: false,
        error: "Exam server security configuration error. Please contact the invigilation helpline.",
      };
    }

    const endTime = new Date(exam.end_time);
    const now = new Date();
    const secondsUntilEnd = Math.max(3600, Math.floor((endTime.getTime() - now.getTime()) / 1000) + 7200);

    const verifiedAppNo = student.application_number || student.roll_number;

    const ticket = jwt.sign(
      {
        type: "DIRECT_EXAM_LAUNCH",
        examId: exam.id,
        studentId: student.id,
        applicationNumber: verifiedAppNo,
        email: student.email,
        fullName: student.full_name,
      },
      jwtSecret,
      { expiresIn: secondsUntilEnd }
    );

    const webSittingUrl = `/sitting?ticket=${ticket}&email=${encodeURIComponent(student.email)}&appNo=${encodeURIComponent(verifiedAppNo)}&passcode=${encodeURIComponent(exam.passcode)}`;
    const launchUrl = webSittingUrl;

    return {
      success: true,
      candidate: {
        id: student.id,
        fullName: student.full_name,
        applicationNumber: verifiedAppNo,
        email: student.email,
        departmentCode,
        departmentName,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        courseCode: exam.course_code,
        startTime: exam.start_time,
        endTime: exam.end_time,
        durationMinutes: exam.duration_minutes,
        passcode: exam.passcode,
        status: exam.status,
      },
      launchUrl,
      webSittingUrl,
    };
  } catch (err: any) {
    console.error("lookupCandidateExam exception:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while verifying candidate.",
    };
  }
}
