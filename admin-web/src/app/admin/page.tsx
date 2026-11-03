import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { 
  FileText, 
  ShieldAlert, 
  Users, 
  PlusCircle, 
  Activity, 
  Lock, 
  ArrowRight, 
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  Calendar,
  Radio,
  Copy,
  ExternalLink,
  Download,
  ShieldCheck,
  BookOpen
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let activeExamsCount = 0;
  let scheduledExamsCount = 0;
  let onlineCandidatesCount = 0;
  let activeViolationsCount = 0;
  let recentExams: any[] = [];
  let userEmail = "admin@kalasalingam.ac.in";

  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.email) {
      userEmail = authData.user.email;
    }

    const [
      { count: activeCount },
      { count: scheduledCount },
      { count: candidatesCount },
      { count: violationsCount },
      { data: examsData }
    ] = await Promise.all([
      supabaseAdmin.from("exams").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
      supabaseAdmin.from("exams").select("*", { count: "exact", head: true }).eq("status", "SCHEDULED"),
      supabaseAdmin.from("exam_sessions").select("*", { count: "exact", head: true }).eq("status", "IN_PROGRESS"),
      supabaseAdmin.from("violation_logs").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("exams").select("id, title, course_code, passcode, duration_minutes, max_strikes, status, start_time, end_time, created_at").order("created_at", { ascending: false }).limit(6),
    ]);

    activeExamsCount = activeCount ?? 0;
    scheduledExamsCount = scheduledCount ?? 0;
    onlineCandidatesCount = candidatesCount ?? 0;
    activeViolationsCount = violationsCount ?? 0;
    recentExams = examsData ?? [];
  } catch (err) {
    console.warn("Notice: Database query notice during page render:", err);
  }

  const adminName = userEmail.split("@")[0].replace(/[0-9]/g, "").replace(".", " ");
  const capitalizedName = adminName.charAt(0).toUpperCase() + adminName.slice(1);

  const stats = [
    {
      title: "Active Examinations",
      value: activeExamsCount,
      subtext: `${scheduledExamsCount} scheduled upcoming`,
      status: activeExamsCount > 0 ? "In Session" : "Idle",
      statusColor: activeExamsCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
      icon: FileText,
      iconBg: "bg-blue-50 text-blue-700",
    },
    {
      title: "Candidates Online",
      value: onlineCandidatesCount,
      subtext: "Connected to lockdown client",
      status: onlineCandidatesCount > 0 ? "Active Telemetry" : "0 Connected",
      statusColor: onlineCandidatesCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
      icon: Users,
      iconBg: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Integrity Violations",
      value: activeViolationsCount,
      subtext: "Total recorded strike events",
      status: activeViolationsCount > 0 ? "Needs Review" : "Clean Integrity",
      statusColor: activeViolationsCount > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200",
      icon: ShieldAlert,
      iconBg: "bg-amber-50 text-amber-700",
    },
    {
      title: "Total Registered Exams",
      value: activeExamsCount + scheduledExamsCount + (recentExams?.length || 0),
      subtext: "Institutional question repository",
      status: "Synced",
      statusColor: "bg-slate-100 text-slate-600 border-slate-200",
      icon: Layers,
      iconBg: "bg-indigo-50 text-indigo-700",
    },
  ];

  return (
    <div className="space-y-8">
      {/* SaaS Executive Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {capitalizedName || "Administrator"}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              KARE Campus
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Kalasalingam Academy of Research and Education • Academic Examination Command Center
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/admin/exams/new"
            className="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Examination
          </Link>
        </div>
      </div>

      {/* World-Class SaaS Metric Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{stat.title}</span>
                  <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="mt-3 flex items-baseline space-x-2">
                  <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {stat.value}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 truncate">{stat.subtext}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stat.statusColor}`}>
                  {stat.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main SaaS Dashboard 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Primary Examination Data Table */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            {/* Table Header Bar */}
            <div className="px-6 py-4.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Institutional Examinations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled, active, and completed test papers in KARE-SES.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href="/admin/exams/new"
                  className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors"
                >
                  + Author New
                </Link>
              </div>
            </div>

            {/* Examination Rows */}
            {recentExams && recentExams.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Paper Details</th>
                      <th className="px-6 py-3">Access Passcode</th>
                      <th className="px-6 py-3">Duration</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {recentExams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {exam.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2">
                            <span>Code: {exam.course_code || "GEN-CORE"}</span>
                            <span>•</span>
                            <span>Max Strikes: {exam.max_strikes || 3}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono font-bold text-slate-800">
                            <span>{exam.passcode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                          {exam.duration_minutes} Mins
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              exam.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                                : exam.status === "SCHEDULED"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : exam.status === "DRAFT"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {exam.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {exam.status === "DRAFT" ? (
                            <Link
                              href={`/admin/exams/new?id=${exam.id}`}
                              className="inline-flex items-center text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline"
                            >
                              Resume Draft
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                          ) : (
                            <Link
                              href={`/admin/exams/${exam.id}`}
                              className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline"
                            >
                              Manage Exam
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* High-End Empty State */
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto shadow-xs border border-blue-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">No Examinations Registered Yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Start by authoring your first multi-department exam paper or import questions in bulk from Excel/CSV.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/admin/exams/new"
                    className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    Open Exam Authoring Studio
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex items-start space-x-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 border border-blue-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Institutional Lockdown Protection Active
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Candidate hardware running the Windows KARE-SES client will automatically enforce low-level keyboard hooks (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">Alt+Tab</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">WinKey</code>) and screen capture blockage via Win32 display affinity.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Quick SaaS Workspaces & Security Feeds */}
        <div className="lg:col-span-4 space-y-6">
          {/* Workspaces Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              OPERATIONAL WORKSPACES
            </span>

            {/* Authoring Studio Card */}
            <Link
              href="/admin/exams/new"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all block group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      Authoring Studio
                    </h3>
                    <p className="text-[11px] text-slate-500">Multi-Dept &amp; CSV Import</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Master Question Bank Card */}
            <Link
              href="/admin/questions"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-xs transition-all block group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-100">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                      Question Bank
                    </h3>
                    <p className="text-[11px] text-slate-500">General Core &amp; Dept MCQs</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Candidate Registry Card */}
            <Link
              href="/admin/students"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all block group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-100">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      Candidate Registry
                    </h3>
                    <p className="text-[11px] text-slate-500">App Numbers &amp; Workstations</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Department Roster Card */}
            <Link
              href="/admin/departments"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all block group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      Departments &amp; Batches
                    </h3>
                    <p className="text-[11px] text-slate-500">Curricula &amp; Cohort Rules</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>

            {/* Live Proctoring Console Card */}
            <Link
              href="/admin/proctoring"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition-all block group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Live Proctoring
                    </h3>
                    <p className="text-[11px] text-slate-500">Realtime Alerts &amp; Freeze</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          </div>

          {/* Realtime Security Stream Monitor */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                SECURITY WATCHDOG
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
                Armed
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Win32 Keyboard Hook</span>
                  <span className="text-emerald-700 font-mono text-[10px]">ACTIVE</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Intercepts Alt+Tab, WinKey, Ctrl+Esc system combinations.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Display Affinity Guard</span>
                  <span className="text-emerald-700 font-mono text-[10px]">WDA_EXCLUDE</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Screenshots &amp; recording software render blacked-out window.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Hypervisor Detector</span>
                  <span className="text-emerald-700 font-mono text-[10px]">ARMED</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  CPUID &amp; WMI detection blocks VMware and VirtualBox.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
