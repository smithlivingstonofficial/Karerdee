"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getExamGradebookAction,
  ExamGradebookData,
  CandidateGradebookItem,
  QuestionAnalyticsItem,
  CandidateQuestionResult,
} from "./actions";
import { formatTime, formatDate, formatDateTime } from "@/lib/date";
import {
  ArrowLeft,
  Printer,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Users,
  Award,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Layers,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Building2,
  ExternalLink,
  Eye,
  Check,
  X,
  FileText,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Monitor,
  Globe,
} from "lucide-react";

export default function ExamResultsGradebookPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params?.id as string;

  const [data, setData] = useState<ExamGradebookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedResultFilter, setSelectedResultFilter] = useState<string>("ALL");
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"SCORE_DESC" | "SCORE_ASC" | "NAME_ASC" | "APP_ASC">("SCORE_DESC");

  // Active View Tab
  const [activeTab, setActiveTab] = useState<"GRADEBOOK" | "QUESTION_ANALYSIS">("GRADEBOOK");

  // Candidate Answer Sheet Inspector Modal State
  const [inspectCandidate, setInspectCandidate] = useState<CandidateGradebookItem | null>(null);
  const [inspectFilter, setInspectFilter] = useState<"ALL" | "CORRECT" | "INCORRECT" | "SKIPPED">("ALL");

  async function loadGradebook() {
    if (!examId) return;
    setIsLoading(true);
    setErrorMsg(null);
    const res = await getExamGradebookAction(examId);
    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.data) {
      setData(res.data);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadGradebook();
  }, [examId]);

  // Filter & Sort Candidates
  const filteredCandidates = useMemo(() => {
    if (!data?.candidates) return [];

    let list = data.candidates.filter((c) => {
      // 1. Text Search
      const matchesSearch =
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.applicationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Department Filter
      const matchesDept =
        selectedDepartment === "ALL" || c.departmentCode === selectedDepartment;

      // 3. Result / Status Filter
      const matchesResult =
        selectedResultFilter === "ALL" ||
        (selectedResultFilter === "PASS" && c.result === "PASS") ||
        (selectedResultFilter === "FAIL" && c.result === "FAIL") ||
        (selectedResultFilter === "IN_PROGRESS" && c.status === "IN_PROGRESS") ||
        (selectedResultFilter === "ABSENT" && c.status === "ABSENT") ||
        (selectedResultFilter === "DISQUALIFIED" && c.status === "DISQUALIFIED");

      // 4. Client Environment Filter
      const matchesClient =
        selectedClientFilter === "ALL" || c.clientType === selectedClientFilter;

      return matchesSearch && matchesDept && matchesResult && matchesClient;
    });

    // Sort
    list.sort((a, b) => {
      if (sortBy === "SCORE_DESC") return b.score - a.score;
      if (sortBy === "SCORE_ASC") return a.score - b.score;
      if (sortBy === "NAME_ASC") return a.fullName.localeCompare(b.fullName);
      if (sortBy === "APP_ASC") return a.applicationNumber.localeCompare(b.applicationNumber);
      return 0;
    });

    return list;
  }, [
    data?.candidates,
    searchQuery,
    selectedDepartment,
    selectedResultFilter,
    selectedClientFilter,
    sortBy,
  ]);

  // Export to CSV Function
  function handleExportCsv() {
    if (!data?.candidates || !data?.exam) return;

    const headers = [
      "Rank",
      "Application Number",
      "Full Name",
      "Email",
      "Department Code",
      "Department Name",
      "Status",
      "Score",
      "Max Score",
      "Percentage",
      "Result",
      "Questions Attempted",
      "Total Questions",
      "Time Spent (Mins)",
      "Strikes",
      "Client Environment",
      "Submission Timestamp",
    ];

    const rows = filteredCandidates.map((c, idx) => [
      idx + 1,
      `"${c.applicationNumber}"`,
      `"${c.fullName.replace(/"/g, '""')}"`,
      `"${c.email}"`,
      `"${c.departmentCode}"`,
      `"${c.departmentName}"`,
      `"${c.status}"`,
      c.score,
      c.maxScore,
      `${c.percentage}%`,
      `"${c.result}"`,
      c.questionsAttempted,
      c.totalQuestions,
      c.durationMinutes,
      c.strikesCount,
      `"${c.clientType}"`,
      c.submittedAt ? `"${formatDateTime(c.submittedAt)}"` : `"N/A"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const examCode = data.exam.courseCode || "EXAM";
    link.setAttribute(
      "download",
      `Gradebook_${examCode}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtered breakdown inside the inspect modal
  const inspectedQuestions = useMemo(() => {
    if (!inspectCandidate) return [];
    if (inspectFilter === "ALL") return inspectCandidate.questionBreakdown;
    if (inspectFilter === "CORRECT")
      return inspectCandidate.questionBreakdown.filter((q) => q.isCorrect);
    if (inspectFilter === "INCORRECT")
      return inspectCandidate.questionBreakdown.filter((q) => q.isAttempted && !q.isCorrect);
    if (inspectFilter === "SKIPPED")
      return inspectCandidate.questionBreakdown.filter((q) => !q.isAttempted);
    return inspectCandidate.questionBreakdown;
  }, [inspectCandidate, inspectFilter]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
        <h2 className="text-sm font-bold text-slate-800">
          Compiling Examination Gradebook &amp; Analytics...
        </h2>
        <p className="text-xs text-slate-500">
          Calculating candidate scores, pass rates, and item accuracy statistics.
        </p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4 font-sans">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
          <h2 className="text-sm font-bold text-red-900">
            Failed to Load Examination Gradebook
          </h2>
          <p className="text-xs text-red-700">{errorMsg || "Unknown error occurred."}</p>
          <div className="pt-2 flex justify-center space-x-3">
            <Link
              href={`/admin/exams/${examId}`}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50"
            >
              Back to Exam Details
            </Link>
            <button
              type="button"
              onClick={loadGradebook}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { exam, metrics, departmentBreakdown, questionAnalytics } = data;

  return (
    <div className="space-y-6 font-sans select-none pb-12">
      {/* 1. Header with Breadcrumb & Action Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs print:shadow-none print:border-none print:p-0">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
            <Link
              href="/admin/exams"
              className="hover:text-blue-700 transition-colors flex items-center"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Examinations</span>
            </Link>
            <span>/</span>
            <Link
              href={`/admin/exams/${examId}`}
              className="hover:text-blue-700 transition-colors truncate max-w-xs"
            >
              {exam.title}
            </Link>
            <span>/</span>
            <span className="text-blue-700 font-bold">Gradebook &amp; Analytics</span>
          </div>

          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {exam.title}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                exam.status === "COMPLETED"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : exam.status === "ACTIVE"
                  ? "bg-blue-50 text-blue-800 border-blue-200 animate-pulse"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {exam.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
            {exam.courseCode && (
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                {exam.courseCode}
              </span>
            )}
            <span>
              Passing Score: <strong className="text-slate-800">{exam.passingScorePercentage}%</strong>
            </span>
            <span>•</span>
            <span>
              Total Marks: <strong className="text-slate-800">{exam.totalPossiblePoints} pts</strong>
            </span>
            <span>•</span>
            <span>
              Negative Marking:{" "}
              <strong className={exam.enableNegativeMarking ? "text-red-600" : "text-slate-700"}>
                {exam.enableNegativeMarking ? "Enabled" : "Disabled"}
              </strong>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
            title="Print Official Gradebook Summary"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-all shadow-2xs cursor-pointer"
            title="Export candidate marks and responses to CSV"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        {/* Metric 1: Attendance & Submissions */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Candidates Appeared</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{metrics.totalSubmitted}</span>
            <span className="text-xs text-slate-500 font-semibold">
              of {metrics.totalEnrolled} enrolled
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{
                width: `${
                  metrics.totalEnrolled > 0
                    ? Math.round((metrics.totalSubmitted / metrics.totalEnrolled) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-0.5">
            <span>
              {metrics.totalAppeared - metrics.totalSubmitted} sitting in-progress
            </span>
            <span>
              {metrics.totalEnrolled - metrics.totalAppeared} absent
            </span>
          </div>
        </div>

        {/* Metric 2: Overall Pass Rate */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Pass Rate ({exam.passingScorePercentage}% threshold)</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-700">{metrics.overallPassRate}%</span>
            <span className="text-xs text-slate-500 font-semibold">
              ({metrics.passCount} passed)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full"
              style={{ width: `${metrics.overallPassRate}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-0.5">
            <span>{metrics.failCount} below passing score</span>
            <span className="text-emerald-700 font-bold">{metrics.passCount} cleared</span>
          </div>
        </div>

        {/* Metric 3: Score Averages */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Average Score</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{metrics.averageScore}</span>
            <span className="text-xs text-slate-500 font-semibold">
              / {exam.totalPossiblePoints} pts ({metrics.averagePercentage}%)
            </span>
          </div>
          <div className="flex items-center space-x-2 pt-1 text-[10px]">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              High: {metrics.highestScore} pt
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
              Median: {metrics.medianScore} pt
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-800 font-bold border border-red-200">
              Low: {metrics.lowestScore} pt
            </span>
          </div>
        </div>

        {/* Metric 4: Security Integrity & Infractions */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Integrity Violations</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-red-700">
              {metrics.totalViolationsRecorded}
            </span>
            <span className="text-xs text-slate-500 font-semibold">strikes recorded</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-snug pt-1">
            Fullscreen exits, tab switches, and unauthorized background keystrokes flagged by the watchdog.
          </p>
        </div>
      </div>

      {/* 3. Department Breakdown Cards */}
      {departmentBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Department Performance Breakdown ({departmentBreakdown.length} Tracks)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Comparative cohort averages
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {departmentBreakdown.map((dept) => (
              <div
                key={dept.departmentCode}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                    {dept.departmentCode}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {dept.submittedCount}/{dept.enrolledCount} Submitted
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-900 truncate">
                  {dept.departmentName}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Avg Score</span>
                    <span className="font-bold text-slate-800">
                      {dept.averageScore} pt ({dept.averagePercentage}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Pass Rate</span>
                    <span
                      className={`font-bold ${
                        dept.passRate >= 60 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {dept.passRate}% ({dept.passCount} passed)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tab Navigation Ribbon (Gradebook vs Item Analysis) */}
      <div className="flex items-center justify-between border-b border-slate-200 pt-2 print:hidden">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("GRADEBOOK")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === "GRADEBOOK"
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Candidate Gradebook Roster ({filteredCandidates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("QUESTION_ANALYSIS")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === "QUESTION_ANALYSIS"
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Question Item Accuracy &amp; Difficulty ({questionAnalytics.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================
          TAB 1: CANDIDATE GRADEBOOK TABLE
         =================================================================== */}
      {activeTab === "GRADEBOOK" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4 print:hidden">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate name, ID, or email..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                {departmentBreakdown.map((d) => (
                  <option key={d.departmentCode} value={d.departmentCode}>
                    {d.departmentCode} Track
                  </option>
                ))}
              </select>

              {/* Result Filter */}
              <select
                value={selectedResultFilter}
                onChange={(e) => setSelectedResultFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Results / Statuses</option>
                <option value="PASS">Pass Only</option>
                <option value="FAIL">Fail Only</option>
                <option value="IN_PROGRESS">Sitting In Progress</option>
                <option value="ABSENT">Absent</option>
                <option value="DISQUALIFIED">Disqualified</option>
              </select>

              {/* Client Environment */}
              <select
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Client Types</option>
                <option value="Web Browser">Web Browser</option>
                <option value="Windows Desktop">Windows Desktop</option>
              </select>

              {/* Sort Order */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-blue-700 focus:outline-none"
              >
                <option value="SCORE_DESC">Score: High to Low</option>
                <option value="SCORE_ASC">Score: Low to High</option>
                <option value="NAME_ASC">Name: A to Z</option>
                <option value="APP_ASC">Application ID</option>
              </select>
            </div>
          </div>

          {/* Roster Table */}
          {filteredCandidates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-1">
              <Users className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-600">No candidates match your filters.</p>
              <p className="text-[11px]">Try adjusting your search query or reset the filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Attempted</th>
                    <th className="py-2.5 px-3">Score &amp; %</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Strikes</th>
                    <th className="py-2.5 px-3 text-right print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredCandidates.map((c, idx) => {
                    const isPassed = c.result === "PASS";
                    const isFailed = c.result === "FAIL";
                    const isSubmitted = c.status === "SUBMITTED";

                    return (
                      <tr
                        key={c.studentId}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Rank */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                          {isSubmitted ? `#${idx + 1}` : "—"}
                        </td>

                        {/* Candidate Details */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{c.fullName}</div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-blue-700 font-semibold">
                              {c.applicationNumber}
                            </span>
                            {c.clientType === "Web Browser" ? (
                              <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200 inline-flex items-center">
                                <Globe className="w-2.5 h-2.5 mr-0.5" />
                                Web
                              </span>
                            ) : c.clientType === "Windows Desktop" ? (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 inline-flex items-center">
                                <Monitor className="w-2.5 h-2.5 mr-0.5" />
                                Desktop
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{c.email}</div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                            {c.departmentCode}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              c.status === "SUBMITTED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : c.status === "IN_PROGRESS"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : c.status === "LOCKED"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>

                        {/* Attempted */}
                        <td className="py-3 px-3 font-medium text-slate-600">
                          {c.questionsAttempted} / {c.totalQuestions}
                        </td>

                        {/* Score & Progress */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-900 font-mono text-sm">
                              {c.score}
                            </span>
                            <span className="text-slate-400 text-[10px]">/ {c.maxScore}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                isPassed
                                  ? "bg-emerald-50 text-emerald-800"
                                  : isFailed
                                  ? "bg-red-50 text-red-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {c.percentage}%
                            </span>
                          </div>
                          <div className="w-24 bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                            <div
                              className={`h-1 rounded-full ${
                                isPassed ? "bg-emerald-600" : isFailed ? "bg-red-600" : "bg-blue-600"
                              }`}
                              style={{ width: `${Math.min(100, c.percentage)}%` }}
                            />
                          </div>
                        </td>

                        {/* Result Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isPassed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-700" />
                              PASS
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-900 border border-red-300">
                              <XCircle className="w-3 h-3 mr-1 text-red-700" />
                              FAIL
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {c.durationMinutes > 0 ? `${c.durationMinutes}m` : "—"}
                        </td>

                        {/* Strikes */}
                        <td className="py-3 px-3 font-mono">
                          {c.strikesCount > 0 ? (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              {c.strikesCount} strike{c.strikesCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">0</span>
                          )}
                        </td>

                        {/* Inspect Action */}
                        <td className="py-3 px-3 text-right whitespace-nowrap print:hidden">
                          {c.sessionId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setInspectCandidate(c);
                                setInspectFilter("ALL");
                              }}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                              title="Inspect question responses and rubric scoring"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              <span>Inspect</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[10px]">No Sitting</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          TAB 2: QUESTION ITEM ANALYSIS (ACCURACY & DIFFICULTY)
         =================================================================== */}
      {activeTab === "QUESTION_ANALYSIS" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Item Analysis &amp; Topic Difficulty
              </h3>
              <p className="text-[11px] text-slate-400">
                Accurate evaluation of candidate answer patterns across all submitted sittings.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Easy: ≥70% Correct
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Medium: 40-69%
              </span>
              <span className="px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200">
                Hard: &lt;40%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Question Prompt</th>
                  <th className="py-2.5 px-3 text-center">Pts</th>
                  <th className="py-2.5 px-3 text-center">Correct</th>
                  <th className="py-2.5 px-3 text-center">Incorrect</th>
                  <th className="py-2.5 px-3 text-center">Skipped</th>
                  <th className="py-2.5 px-3">Accuracy</th>
                  <th className="py-2.5 px-3 text-right">Difficulty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {questionAnalytics.map((q, idx) => (
                  <tr key={q.questionId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-slate-500">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {q.sectionTitle}
                    </td>

                    <td className="py-3 px-3 max-w-md">
                      <p className="line-clamp-2 leading-relaxed text-slate-900 font-medium">
                        {q.prompt}
                      </p>
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                      +{q.points}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-emerald-700">
                      {q.correctAttempts}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-red-600">
                      {q.incorrectAttempts}
                    </td>

                    <td className="py-3 px-3 text-center font-medium text-slate-400">
                      {q.skippedAttempts}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 font-mono">
                          {q.accuracyRate}%
                        </span>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              q.accuracyRate >= 70
                                ? "bg-emerald-600"
                                : q.accuracyRate >= 40
                                ? "bg-amber-500"
                                : "bg-red-600"
                            }`}
                            style={{ width: `${q.accuracyRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          q.difficultyRating === "EASY"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : q.difficultyRating === "MEDIUM"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {q.difficultyRating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: CANDIDATE ANSWER SHEET INSPECTOR
         =================================================================== */}
      {inspectCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:hidden">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Top Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Candidate Response Sheet: {inspectCandidate.fullName}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      inspectCandidate.result === "PASS"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-red-100 text-red-900 border border-red-300"
                    }`}
                  >
                    {inspectCandidate.result} ({inspectCandidate.percentage}%)
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                  <span>ID: {inspectCandidate.applicationNumber}</span>
                  <span>•</span>
                  <span>{inspectCandidate.departmentName} ({inspectCandidate.departmentCode})</span>
                  <span>•</span>
                  <span>Score: {inspectCandidate.score} / {inspectCandidate.maxScore} pts</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar inside Modal */}
            <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <span className="text-xs font-bold text-slate-700">
                Responses Breakdown ({inspectedQuestions.length} Questions)
              </span>

              <div className="flex items-center space-x-1.5 text-xs">
                {(["ALL", "CORRECT", "INCORRECT", "SKIPPED"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInspectFilter(mode)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                      inspectFilter === mode
                        ? "bg-blue-700 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions List Surface */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
              {inspectedQuestions.map((q, idx) => {
                return (
                  <div
                    key={q.questionId}
                    className={`bg-white border rounded-xl p-4 shadow-2xs space-y-3 ${
                      q.isCorrect
                        ? "border-emerald-200 bg-emerald-50/20"
                        : q.isAttempted
                        ? "border-red-200 bg-red-50/20"
                        : "border-slate-200"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-xs text-blue-800">
                          Question {idx + 1}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Section: {q.sectionTitle}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {q.isCorrect ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <Check className="w-3 h-3 mr-0.5" />
                            Correct (+{q.points} pt)
                          </span>
                        ) : q.isAttempted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                            <X className="w-3 h-3 mr-0.5" />
                            Incorrect ({q.awardedPoints} pt)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            Unattempted (0 pt)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prompt */}
                    <div className="text-xs font-semibold text-slate-900 leading-relaxed">
                      {q.prompt}
                    </div>

                    {/* Answers Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                      {/* Candidate Selected Option */}
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Candidate Selection:
                        </span>
                        {q.selectedOptionTexts.length > 0 ? (
                          <div className="font-semibold text-slate-900 leading-snug">
                            {q.selectedOptionTexts.join(", ")}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            No option selected
                          </span>
                        )}
                      </div>

                      {/* Correct Answer Key */}
                      <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                          Official Correct Option:
                        </span>
                        <div className="font-bold text-emerald-950 leading-snug">
                          {q.correctOptionTexts.join(", ") || "Answer key not assigned"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom Bar */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-white">
              <button
                type="button"
                onClick={() => setInspectCandidate(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Close Response Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
