import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    // Default Quick Nav Items
    const defaultNav = [
      {
        id: "nav-exams",
        title: "Examinations Hub",
        category: "Navigation",
        subtitle: "View and manage all institutional exam papers",
        url: "/admin/exams",
        badge: "Hub",
      },
      {
        id: "nav-proctoring",
        title: "Live Invigilation Room",
        category: "Navigation",
        subtitle: "Realtime candidate proctoring and security monitoring",
        url: "/admin/proctoring",
        badge: "Live",
      },
      {
        id: "nav-new",
        title: "Create Examination",
        category: "Navigation",
        subtitle: "Author a new exam paper or import questions",
        url: "/admin/exams/new",
        badge: "Authoring",
      },
      {
        id: "nav-questions",
        title: "Master Question Bank",
        category: "Navigation",
        subtitle: "Multi-department question bank & rubrics",
        url: "/admin/questions",
        badge: "Repository",
      },
      {
        id: "nav-students",
        title: "Candidate Registry",
        category: "Navigation",
        subtitle: "Student rosters, application numbers, workstations",
        url: "/admin/students",
        badge: "Students",
      },
      {
        id: "nav-violations",
        title: "Security Violations & Forensics",
        category: "Navigation",
        subtitle: "Review integrity infractions, strikes, and snapshots",
        url: "/admin/violations",
        badge: "Security",
      },
    ];

    if (!query) {
      return NextResponse.json({
        exams: [],
        students: [],
        navigation: defaultNav,
      });
    }

    const sanitized = `%${query}%`;

    // Concurrently search Examinations & Students
    const [
      { data: examsData },
      { data: studentsData },
      { data: deptsData },
    ] = await Promise.all([
      supabaseAdmin
        .from("exams")
        .select("id, title, course_code, passcode, status, duration_minutes")
        .or(`title.ilike.${sanitized},course_code.ilike.${sanitized},passcode.ilike.${sanitized}`)
        .limit(6),
      supabaseAdmin
        .from("students")
        .select(`
          id,
          full_name,
          application_number,
          email,
          department:departments (code)
        `)
        .or(`full_name.ilike.${sanitized},application_number.ilike.${sanitized},email.ilike.${sanitized}`)
        .limit(6),
      supabaseAdmin
        .from("departments")
        .select("id, name, code")
        .or(`name.ilike.${sanitized},code.ilike.${sanitized}`)
        .limit(4),
    ]);

    const exams = (examsData || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      category: "Examination",
      courseCode: e.course_code || "GEN-CORE",
      passcode: e.passcode,
      status: e.status,
      durationMinutes: e.duration_minutes,
      url: `/admin/exams/${e.id}`,
    }));

    const students = (studentsData || []).map((s: any) => {
      const dept = Array.isArray(s.department) ? s.department[0] : s.department;
      return {
        id: s.id,
        title: s.full_name,
        category: "Candidate",
        applicationNumber: s.application_number || s.id.slice(0, 8).toUpperCase(),
        departmentCode: dept?.code || "GEN",
        email: s.email,
        url: `/admin/students?q=${encodeURIComponent(s.application_number || s.full_name)}`,
      };
    });

    const matchingNav = defaultNav.filter(
      (n) =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.subtitle.toLowerCase().includes(query.toLowerCase())
    );

    const departments = (deptsData || []).map((d: any) => ({
      id: d.id,
      title: `${d.name} (${d.code})`,
      category: "Department",
      code: d.code,
      url: `/admin/departments`,
    }));

    return NextResponse.json({
      exams,
      students,
      departments,
      navigation: matchingNav,
    });
  } catch (err: any) {
    console.error("Global search error:", err);
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 });
  }
}
