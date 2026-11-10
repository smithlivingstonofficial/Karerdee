"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ShieldAlert,
  Users,
  PlusCircle,
  Activity,
  Layers,
  Search,
  CheckCircle2,
  Calendar,
  Radio,
  Copy,
  ExternalLink,
  Download,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  Clock,
  Sparkles,
  BarChart2,
  ChevronRight,
  Monitor,
  Compass,
} from "lucide-react";
import { formatDate } from "@/lib/date";

export interface DashboardExamItem {
  id: string;
  title: string;
  course_code: string | null;
  passcode: string;
  duration_minutes: number;
  max_strikes: number;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  departments?: string[];
  totalSessions?: number;
  activeSessions?: number;
}

export interface DashboardViolationItem {
  id: string;
  candidateName: string;
  applicationNumber: string;
  departmentCode: string;
  examTitle: string;
  violationType: string;
  strikeNumber: number;
  createdAt: string;
}

interface AdminDashboardClientViewProps {
  userEmail: string;
  stats: {
    activeExamsCount: number;
    scheduledExamsCount: number;
    completedExamsCount: number;
    onlineCandidatesCount: number;
    activeViolationsCount: number;
    totalQuestionsCount: number;
    totalDepartmentsCount: number;
  };
  exams: DashboardExamItem[];
  recentViolations: DashboardViolationItem[];
}

export function AdminDashboardClientView({
  userEmail,
  stats,
  exams,
  recentViolations,
}: AdminDashboardClientViewProps) {
  // Live Clock & Greeting
  const [currentDateTime, setCurrentDateTime] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("Welcome back");
  const [examTab, setExamTab] = useState<"ALL" | "ACTIVE" | "SCHEDULED" | "COMPLETED">("ALL");
  const [copiedPasscodeId, setCopiedPasscodeId] = useState<string | null>(null);
  const [examSearch, setExamSearch] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      if (hours < 12) setGreeting("Good morning");
      else if (hours < 17) setGreeting("Good afternoon");
      else setGreeting("Good evening");

      setCurrentDateTime(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const adminName = userEmail
    ? userEmail.split("@")[0].replace(/[0-9]/g, "").replace(".", " ")
    : "Administrator";
  const capitalizedName = adminName.charAt(0).toUpperCase() + adminName.slice(1);

  // Copy passcode handler
  const handleCopyPasscode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPasscodeId(id);
    setTimeout(() => setCopiedPasscodeId(null), 2000);
  };

  // Filter exams by tab & search query
  const filteredExams = exams.filter((exam) => {
    if (examTab === "ACTIVE" && exam.status !== "ACTIVE") return false;
    if (examTab === "SCHEDULED" && exam.status !== "SCHEDULED") return false;
    if (examTab === "COMPLETED" && exam.status !== "COMPLETED") return false;

    if (examSearch.trim()) {
      const q = examSearch.toLowerCase();
      const matchTitle = exam.title.toLowerCase().includes(q);
      const matchCode = (exam.course_code || "").toLowerCase().includes(q);
      const matchPass = exam.passcode.toLowerCase().includes(q);
      return matchTitle || matchCode || matchPass;
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* 1. Combined Executive Command Center & KPI Cockpit */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Top Header Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50/30 to-blue-50/20">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xs border border-blue-200/80 flex-shrink-0 select-none shadow-2xs">
              KARE
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {greeting}, {capitalizedName}
                </h1>
                {currentDateTime && (
                  <span className="text-xs text-slate-400 font-medium">
                    • {currentDateTime}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Link
              href="/admin/proctoring"
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 rounded-lg shadow-2xs transition-all cursor-pointer group"
              title="Open Live Proctoring & Security Telemetry Grid"
            >
              <Radio className="w-3.5 h-3.5 mr-1.5 text-emerald-600 animate-pulse" />
              <span>Live Invigilation</span>
              {stats.onlineCandidatesCount > 0 ? (
                <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-black shadow-2xs">
                  {stats.onlineCandidatesCount}
                </span>
              ) : (
                <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-200/60 text-emerald-800 rounded-full text-[10px] font-bold">
                  0
                </span>
              )}
            </Link>

            <Link
              href="/admin/exams/new"
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs hover:shadow-2xs transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1" />
              <span>New Exam</span>
            </Link>
          </div>
        </div>

        {/* 4 Clean Metric Cells (Zero Unwanted Text, Streamlined Padding) */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1 */}
          <Link
            href="/admin/exams"
            className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Active Exams
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  stats.activeExamsCount > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {stats.activeExamsCount > 0 ? "Running" : "Idle"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.activeExamsCount}
              </span>
              <span className="text-xs text-slate-400">in-session</span>
              {stats.scheduledExamsCount > 0 && (
                <span className="text-[11px] text-slate-400 ml-auto font-medium">
                  {stats.scheduledExamsCount} upcoming
                </span>
              )}
            </div>
          </Link>

          {/* Metric 2 */}
          <Link
            href="/admin/proctoring"
            className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                Candidates Online
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] flex items-center space-x-1 ${
                  stats.onlineCandidatesCount > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {stats.onlineCandidatesCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping mr-0.5" />
                )}
                <span>{stats.onlineCandidatesCount > 0 ? "Active" : "Standby"}</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.onlineCandidatesCount}
              </span>
              <span className="text-xs text-slate-400">examinees</span>
            </div>
          </Link>

          {/* Metric 3 */}
          <Link
            href="/admin/violations"
            className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                Integrity Strikes
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  stats.activeViolationsCount > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {stats.activeViolationsCount > 0 ? "Needs Review" : "Clean"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.activeViolationsCount}
              </span>
              <span className="text-xs text-slate-400">infractions</span>
            </div>
          </Link>

          {/* Metric 4 */}
          <Link
            href="/admin/questions"
            className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-purple-700 transition-colors">
                Question Bank
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                {stats.totalDepartmentsCount} Depts
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.totalQuestionsCount}
              </span>
              <span className="text-xs text-slate-400">items</span>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. Compact Quick Invigilator Ribbon */}
      <div className="bg-slate-100/70 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center justify-between overflow-x-auto gap-2 text-xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 flex items-center space-x-1">
          <Compass className="w-3 h-3 text-blue-700" />
          <span>Quick Launch:</span>
        </span>

        <div className="flex items-center space-x-1.5 flex-nowrap">
          <Link
            href="/admin/exams"
            className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg shadow-2xs transition-all whitespace-nowrap"
          >
            <FileText className="w-3 h-3 mr-1 text-blue-700" />
            <span>Examinations</span>
          </Link>

          <Link
            href="/admin/exams/new"
            className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg shadow-2xs transition-all whitespace-nowrap"
          >
            <PlusCircle className="w-3 h-3 mr-1 text-emerald-700" />
            <span>Authoring</span>
          </Link>

          <Link
            href="/admin/students"
            className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg shadow-2xs transition-all whitespace-nowrap"
          >
            <Users className="w-3 h-3 mr-1 text-indigo-700" />
            <span>Candidates</span>
          </Link>

          <Link
            href="/admin/departments"
            className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg shadow-2xs transition-all whitespace-nowrap"
          >
            <Layers className="w-3 h-3 mr-1 text-purple-700" />
            <span>Departments</span>
          </Link>

          <Link
            href="/admin/violations"
            className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg shadow-2xs transition-all whitespace-nowrap"
          >
            <ShieldAlert className="w-3 h-3 mr-1 text-amber-700" />
            <span>Violations</span>
          </Link>
        </div>
      </div>

      {/* 4. Main SaaS Operations Grid (8 Cols Left, 4 Cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Primary Examination Data Matrix */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
            {/* Header with Title and Filter Tabs */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                    <span>Institutional Examination Papers</span>
                    <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {exams.length} Total
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Real-time status, access passcodes, attendance telemetry, and direct evaluation.
                  </p>
                </div>

                <Link
                  href="/admin/exams/new"
                  className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1" />
                  <span>+ Author New</span>
                </Link>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="inline-flex p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/70 text-xs font-bold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setExamTab("ALL")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                      examTab === "ALL"
                        ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                        : "hover:text-slate-900"
                    }`}
                  >
                    All ({exams.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamTab("ACTIVE")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                      examTab === "ACTIVE"
                        ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                        : "hover:text-slate-900"
                    }`}
                  >
                    In Session ({stats.activeExamsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamTab("SCHEDULED")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                      examTab === "SCHEDULED"
                        ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                        : "hover:text-slate-900"
                    }`}
                  >
                    Scheduled ({stats.scheduledExamsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExamTab("COMPLETED")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                      examTab === "COMPLETED"
                        ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                        : "hover:text-slate-900"
                    }`}
                  >
                    Concluded ({stats.completedExamsCount})
                  </button>
                </div>

                {/* Quick Search inside Table */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    placeholder="Search papers..."
                    className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-700 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Examination Data Table */}
            {filteredExams.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Paper Details</th>
                      <th className="px-4 py-2.5">Passcode</th>
                      <th className="px-4 py-2.5">Duration</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredExams.map((exam) => {
                      const isCopied = copiedPasscodeId === exam.id;
                      const isActive = exam.status === "ACTIVE";
                      const isScheduled = exam.status === "SCHEDULED";
                      const isCompleted = exam.status === "COMPLETED";
                      const isDraft = exam.status === "DRAFT";

                      return (
                        <tr
                          key={exam.id}
                          className="hover:bg-slate-50/70 transition-colors group"
                        >
                          {/* Paper Details */}
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-700 transition-colors">
                                {exam.title}
                              </div>
                              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 flex-wrap">
                                <span className="font-mono font-bold bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200 text-[10px]">
                                  {exam.course_code || "GEN-CORE"}
                                </span>
                                <span>•</span>
                                <span>Strikes: {exam.max_strikes}</span>
                                {exam.activeSessions !== undefined && exam.activeSessions > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-700 font-bold flex items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1 animate-pulse" />
                                      {exam.activeSessions} online
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Access Passcode with One-Click Copy */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleCopyPasscode(exam.id, exam.passcode)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200/90 font-mono font-bold text-slate-800 text-xs transition-colors cursor-pointer group/btn"
                              title="Click to copy passcode"
                            >
                              <span>{exam.passcode}</span>
                              {isCopied ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 animate-in fade-in" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400 group-hover/btn:text-blue-700 transition-colors" />
                              )}
                            </button>
                            {isCopied && (
                              <div className="text-[9px] text-emerald-600 font-semibold animate-in fade-in">
                                Copied!
                              </div>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-1 text-slate-600 font-medium text-[11px]">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{exam.duration_minutes} Mins</span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.2 rounded-full text-[9px] font-extrabold border ${
                                isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                                  : isScheduled
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : isDraft
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1 animate-ping" />
                              )}
                              {isActive
                                ? "IN SESSION"
                                : isScheduled
                                ? "SCHEDULED"
                                : isDraft
                                ? "DRAFT"
                                : "CONCLUDED"}
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {isActive && (
                                <Link
                                  href="/admin/proctoring"
                                  className="inline-flex items-center px-2 py-1 text-[10px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-2xs transition-colors"
                                  title="Enter Live Proctoring Stream"
                                >
                                  <Radio className="w-2.5 h-2.5 mr-1 fill-current animate-pulse" />
                                  <span>Live</span>
                                </Link>
                              )}

                              {isCompleted && (
                                <Link
                                  href={`/admin/exams/${exam.id}/results`}
                                  className="inline-flex items-center px-2 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md shadow-2xs transition-colors"
                                  title="Inspect Gradebook & Scores"
                                >
                                  <BarChart2 className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                                  <span>Results</span>
                                </Link>
                              )}

                              {isDraft && (
                                <Link
                                  href={`/admin/exams/new?id=${exam.id}`}
                                  className="inline-flex items-center px-2 py-1 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md shadow-2xs transition-colors"
                                >
                                  <span>Resume</span>
                                  <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                                </Link>
                              )}

                              <Link
                                href={`/admin/exams/${exam.id}`}
                                className="inline-flex items-center px-2 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition-colors"
                              >
                                <span>Details</span>
                                <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto shadow-xs border border-blue-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900">No Examinations Found</h3>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    No examination records match the selected filter or search term.
                  </p>
                </div>
              </div>
            )}

            {/* Footer Directory Link */}
            <div className="p-2.5 px-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Showing {filteredExams.length} of {exams.length} papers
              </span>
              <Link
                href="/admin/exams"
                className="font-bold text-blue-700 hover:text-blue-800 inline-flex items-center space-x-1"
              >
                <span>Complete Directory</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Institutional Lockdown Architecture Callout Banner */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 border border-blue-100">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 truncate">
                  Dual-Tier Lockdown Protection Active
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  Kernel-level Win32 keyboard hooks (Alt+Tab/WinKey) and SetWindowDisplayAffinity screen capture blockage.
                </p>
              </div>
            </div>

            <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex-shrink-0">
              Armed &amp; Healthy
            </span>
          </div>
        </div>

        {/* Right Column (4 cols): Realtime Security Cockpit & Live Activity Stream */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Active Defense Watchdog */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                SECURITY COCKPIT
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1 animate-pulse" />
                Armed
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
                <span className="font-semibold text-slate-800">Win32 Keyboard Hook</span>
                <span className="text-emerald-700 font-mono text-[9px] font-bold">ARMED</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
                <span className="font-semibold text-slate-800">Display Affinity Guard</span>
                <span className="text-emerald-700 font-mono text-[9px] font-bold">WDA_EXCLUDE</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
                <span className="font-semibold text-slate-800">Hypervisor Detector</span>
                <span className="text-emerald-700 font-mono text-[9px] font-bold">BLOCKED</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
                <span className="font-semibold text-slate-800">Realtime WebSocket</span>
                <span className="text-blue-700 font-mono text-[9px] font-bold">5000ms</span>
              </div>
            </div>
          </div>

          {/* Card 2: Live Security Incident Stream */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                INTEGRITY STREAM
              </span>
              <Link
                href="/admin/violations"
                className="text-[10px] font-bold text-blue-700 hover:text-blue-800 transition-colors"
              >
                View All →
              </Link>
            </div>

            {recentViolations && recentViolations.length > 0 ? (
              <div className="space-y-1.5">
                {recentViolations.map((v) => (
                  <div
                    key={v.id}
                    className="p-2 rounded-lg border border-slate-200 hover:border-amber-300 bg-white transition-all text-[11px] space-y-0.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[140px]">
                        {v.candidateName}
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        Strike #{v.strikeNumber}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 truncate">
                      {v.violationType} • {v.applicationNumber}
                    </div>

                    <div className="text-[9px] text-slate-400 flex items-center justify-between pt-0.5">
                      <span>{formatDate(v.createdAt)}</span>
                      <Link
                        href="/admin/violations"
                        className="text-blue-700 font-bold hover:underline"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center space-y-1 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto" />
                <div className="text-[11px] font-bold text-slate-800">Clean Stream</div>
                <div className="text-[10px] text-slate-400">
                  Zero active security infractions logged.
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Windows Desktop Client Package */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-3.5 shadow-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100 flex-shrink-0">
                <Monitor className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 truncate">
                  Windows Exam Client
                </h3>
                <p className="text-[10px] text-slate-400 truncate">Release v3.0.4 • .NET 8</p>
              </div>
            </div>

            <a
              href="/api/download/client"
              download
              className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              title="Download Desktop Launcher"
            >
              <Download className="w-3 h-3 mr-1 text-slate-600" />
              <span>.exe</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
