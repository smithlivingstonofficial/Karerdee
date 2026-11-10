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
  Radio,
  BookOpen,
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
  const [activeTab, setActiveTab] = useState<"GRADEBOOK" | "QUESTION_ANALYSIS" | "DEPARTMENTS">("GRADEBOOK");

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

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
        <h2 className="text-sm font-bold text-slate-800">
          Compiling Examination Gradebook &amp; Analytics...
        </h2>
        <p className="text-xs text-slate-500">
          Aggregating all examination questions, candidate scores, and departmental benchmarks.
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
    <div className="space-y-4 max-w-7xl mx-auto pb-12 w-full font-sans">
      {/* 1. Master Executive Command Cockpit Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Top Header Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50/30 to-blue-50/20">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Official Square KARE Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 p-0.5 flex items-center justify-center flex-shrink-0 shadow-2xs overflow-hidden">
              <img
                src="/kare-square-logo.png"
                alt="KARE Logo"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <Link
                  href="/admin/exams"
                  className="text-xs text-slate-400 hover:text-blue-700 transition-colors flex items-center"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  <span>Exams</span>
                </Link>
                <span className="text-slate-300">/</span>
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate max-w-md">
                  {exam.title}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
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
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                <span>Passing: {exam.passingScorePercentage}%</span>
                <span>•</span>
                <span>Total Marks: {exam.totalPossiblePoints} pts ({questionAnalytics.length} Questions)</span>
                <span>•</span>
                <span>
                  Negative Marking:{" "}
                  <strong className={exam.enableNegativeMarking ? "text-red-600" : "text-slate-600"}>
                    {exam.enableNegativeMarking ? "Active" : "None"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 flex-shrink-0 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
              title="Print official institutional summary report"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Report</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
              title="Export complete marks roster to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Clean Metric Cells */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1: Candidates Appeared */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Candidates Appeared
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                {metrics.totalSubmitted} Finalized
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {metrics.totalAppeared}
              </span>
              <span className="text-xs text-slate-400">of {metrics.totalEnrolled} enrolled</span>
            </div>
          </div>

          {/* Metric 2: Overall Pass Rate */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                Overall Pass Rate
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                {metrics.passCount} Cleared
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-emerald-700 tracking-tight">
                {metrics.overallPassRate}%
              </span>
              <span className="text-xs text-slate-400">≥ {exam.passingScorePercentage}% threshold</span>
            </div>
          </div>

          {/* Metric 3: Average Marks */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-700 transition-colors">
                Class Mean Score
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-indigo-50 text-indigo-700 border-indigo-200">
                {metrics.averagePercentage}% Avg
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {metrics.averageScore}
              </span>
              <span className="text-xs text-slate-400">/ {exam.totalPossiblePoints} pts</span>
            </div>
          </div>

          {/* Metric 4: Highest Mark */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                Top Score
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-amber-50 text-amber-800 border-amber-200">
                Rank #1
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-amber-700 tracking-tight">
                {metrics.highestScore}
              </span>
              <span className="text-xs text-slate-400">pts (Med: {metrics.medianScore})</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Modern Segmented Tab Switcher */}
      <div className="flex items-center p-1 bg-slate-100/90 rounded-xl space-x-1 w-fit overflow-x-auto max-w-full scrollbar-none print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("GRADEBOOK")}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === "GRADEBOOK"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Candidate Gradebook ({filteredCandidates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("QUESTION_ANALYSIS")}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === "QUESTION_ANALYSIS"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Question Item Accuracy ({questionAnalytics.length} Questions)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DEPARTMENTS")}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === "DEPARTMENTS"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Faculty Benchmarks ({departmentBreakdown.length} Tracks)</span>
        </button>
      </div>

      {/* ===================================================================
          TAB 1: CANDIDATE GRADEBOOK TABLE
         =================================================================== */}
      {activeTab === "GRADEBOOK" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          {/* Tier 1: Toolbar with Quick Filters & Integrated Search */}
          <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50 print:hidden">
            {/* Quick Result Selector */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl space-x-1 w-fit overflow-x-auto max-w-full scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedResultFilter("ALL")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  selectedResultFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Statuses
              </button>
              <button
                type="button"
                onClick={() => setSelectedResultFilter("PASS")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap text-emerald-800 ${
                  selectedResultFilter === "PASS"
                    ? "bg-white shadow-xs font-extrabold"
                    : "hover:text-emerald-900"
                }`}
              >
                Pass ({metrics.passCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedResultFilter("FAIL")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap text-red-700 ${
                  selectedResultFilter === "FAIL"
                    ? "bg-white shadow-xs font-extrabold"
                    : "hover:text-red-900"
                }`}
              >
                Fail ({metrics.failCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedResultFilter("IN_PROGRESS")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap text-blue-700 ${
                  selectedResultFilter === "IN_PROGRESS"
                    ? "bg-white shadow-xs font-extrabold"
                    : "hover:text-blue-900"
                }`}
              >
                Sitting ({metrics.totalAppeared - metrics.totalSubmitted})
              </button>
              <button
                type="button"
                onClick={() => setSelectedResultFilter("ABSENT")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap text-slate-600 ${
                  selectedResultFilter === "ABSENT"
                    ? "bg-white shadow-xs font-extrabold"
                    : "hover:text-slate-900"
                }`}
              >
                Absent ({metrics.totalEnrolled - metrics.totalAppeared})
              </button>
            </div>

            {/* Search Box & Sort */}
            <div className="flex items-center space-x-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search candidate name, ID, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-blue-700 focus:outline-none cursor-pointer shadow-2xs"
              >
                <option value="SCORE_DESC">Score: High to Low</option>
                <option value="SCORE_ASC">Score: Low to High</option>
                <option value="NAME_ASC">Name: A to Z</option>
                <option value="APP_ASC">Application ID</option>
              </select>
            </div>
          </div>

          {/* Tier 2: Department Filter Tabs */}
          {departmentBreakdown.length > 0 && (
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto scrollbar-none bg-white print:hidden">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">
                Department:
              </span>
              <button
                type="button"
                onClick={() => setSelectedDepartment("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                  selectedDepartment === "ALL"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/90"
                }`}
              >
                All Departments ({data.candidates.length})
              </button>
              {departmentBreakdown.map((d) => (
                <button
                  key={d.departmentCode}
                  type="button"
                  onClick={() => setSelectedDepartment(d.departmentCode)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                    selectedDepartment === d.departmentCode
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/90"
                  }`}
                >
                  {d.departmentCode} ({d.enrolledCount})
                </button>
              ))}
            </div>
          )}

          {/* Candidates Roster Table */}
          {filteredCandidates.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No candidates match your criteria</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try clearing your search query or reset the department filter to view all enrolled examinees.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 sm:px-4 w-12 text-center">Rank</th>
                    <th className="py-3 px-3 sm:px-4">Candidate &amp; Identity</th>
                    <th className="py-3 px-3 sm:px-4">Department</th>
                    <th className="py-3 px-3 sm:px-4">Session Status</th>
                    <th className="py-3 px-3 sm:px-4">Attempted</th>
                    <th className="py-3 px-3 sm:px-4">Score &amp; %</th>
                    <th className="py-3 px-3 sm:px-4">Result</th>
                    <th className="py-3 px-3 sm:px-4">Duration</th>
                    <th className="py-3 px-3 sm:px-4">Strikes</th>
                    <th className="py-3 px-3 sm:px-4 text-right print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCandidates.map((c, idx) => {
                    const isPassed = c.result === "PASS";
                    const isFailed = c.result === "FAIL";
                    const isSubmitted = c.status === "SUBMITTED";
                    const initials = getInitials(c.fullName);

                    return (
                      <tr key={c.studentId} className="hover:bg-slate-50/70 transition-colors">
                        {/* Rank */}
                        <td className="py-3.5 px-3 sm:px-4 text-center font-mono font-bold text-slate-400">
                          {isSubmitted ? `#${idx + 1}` : "—"}
                        </td>

                        {/* Candidate Details */}
                        <td className="py-3.5 px-3 sm:px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200/60 flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm tracking-tight">
                                {c.fullName}
                              </div>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="font-mono text-[11px] font-bold text-slate-600">
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
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-3 sm:px-4">
                          <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200/80">
                            {c.departmentCode}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 sm:px-4">
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

                        {/* Questions Attempted out of ALL questions in exam */}
                        <td className="py-3.5 px-3 sm:px-4 font-semibold text-slate-700">
                          {c.questionsAttempted} / {c.totalQuestions}
                        </td>

                        {/* Score & Progress */}
                        <td className="py-3.5 px-3 sm:px-4">
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
                        <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
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
                        <td className="py-3.5 px-3 sm:px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {c.durationMinutes > 0 ? `${c.durationMinutes}m` : "—"}
                        </td>

                        {/* Strikes */}
                        <td className="py-3.5 px-3 sm:px-4 font-mono">
                          {c.strikesCount > 0 ? (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              {c.strikesCount} strike{c.strikesCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">0</span>
                          )}
                        </td>

                        {/* Inspect Action */}
                        <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap print:hidden">
                          {c.sessionId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setInspectCandidate(c);
                                setInspectFilter("ALL");
                              }}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                              title="Inspect complete answer sheet across all exam questions"
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
          TAB 2: QUESTION ITEM ANALYSIS (ALL QUESTIONS IN EXAM)
         =================================================================== */}
      {activeTab === "QUESTION_ANALYSIS" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Question Item Analysis ({questionAnalytics.length} Institutional Questions)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Evaluates candidate answer accuracy across all common and department-track questions in this examination paper.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Easy: ≥70%
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
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 sm:px-4 w-12 text-center">#</th>
                  <th className="py-3 px-3 sm:px-4">Section / Curriculum</th>
                  <th className="py-3 px-3 sm:px-4">Question Prompt</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Pts</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Correct</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Incorrect</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Skipped</th>
                  <th className="py-3 px-3 sm:px-4">Accuracy</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Difficulty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {questionAnalytics.map((q, idx) => (
                  <tr key={q.questionId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-500">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-3 sm:px-4 font-semibold text-slate-800 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        {q.sectionTitle}
                      </span>
                    </td>

                    <td className="py-3 px-3 sm:px-4 max-w-md">
                      <p className="line-clamp-2 leading-relaxed text-slate-900 font-medium">
                        {q.prompt}
                      </p>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center font-mono font-bold text-slate-700">
                      +{q.points}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center font-bold text-emerald-700">
                      {q.correctAttempts}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center font-bold text-red-600">
                      {q.incorrectAttempts}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center font-medium text-slate-400">
                      {q.skippedAttempts}
                    </td>

                    <td className="py-3 px-3 sm:px-4">
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

                    <td className="py-3 px-3 sm:px-4 text-right">
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
          TAB 3: DEPARTMENT BENCHMARKS & COMPARATIVE PERFORMANCE
         =================================================================== */}
      {activeTab === "DEPARTMENTS" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Departmental Performance Breakdown ({departmentBreakdown.length} Academic Tracks)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Comparative examination outcomes aggregated across candidate departmental affiliations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {departmentBreakdown.map((dept) => (
              <div
                key={dept.departmentCode}
                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-white text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                    {dept.departmentCode}
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {dept.submittedCount} / {dept.enrolledCount} Finalized
                  </span>
                </div>

                <div className="font-bold text-sm text-slate-900 truncate">
                  {dept.departmentName}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Class Average</span>
                    <span className="font-extrabold text-slate-900">
                      {dept.averageScore} pt ({dept.averagePercentage}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Pass Rate</span>
                    <span
                      className={`font-extrabold ${
                        dept.passRate >= 60 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {dept.passRate}% ({dept.passCount} cleared)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: CANDIDATE ANSWER SHEET INSPECTOR (ALL QUESTIONS EVALUATED)
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
                  <span>Department: {inspectCandidate.departmentName} ({inspectCandidate.departmentCode})</span>
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
                Complete Examination Paper ({inspectedQuestions.length} Questions Evaluated)
              </span>

              <div className="flex items-center space-x-1.5 text-xs">
                {(["ALL", "CORRECT", "INCORRECT", "SKIPPED"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInspectFilter(mode)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                      inspectFilter === mode
                        ? "bg-blue-600 text-white shadow-2xs"
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
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
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
                            Not attempted / No option selected
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
