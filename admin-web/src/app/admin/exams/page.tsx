"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getExamsAction,
  deleteExamAction,
  updateExamStatusAction,
  duplicateExamAction,
  ExamSummaryItem,
} from "./actions";
import { ExamStatus } from "@/types/database.types";
import {
  PlusCircle,
  Search,
  Filter,
  FileText,
  Clock,
  Layers,
  HelpCircle,
  Copy,
  Trash2,
  Calendar,
  KeyRound,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
  Play,
  Square,
  Bookmark,
  ExternalLink,
  ChevronRight,
  Shield,
  Printer,
  BarChart2,
} from "lucide-react";

type FilterStatus = "ALL" | "SCHEDULED" | "ACTIVE" | "DRAFT" | "COMPLETED";

export default function ExaminationsDirectoryPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load exams
  async function loadExams() {
    setIsLoading(true);
    const res = await getExamsAction();
    if (res.exams) {
      setExams(res.exams);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadExams();
  }, []);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  }

  // Copy passcode helper
  function copyPasscode(id: string, code: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Handle Delete
  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"? This action cannot be undone.`)) {
      return;
    }
    setActionLoadingId(id);
    const res = await deleteExamAction(id);
    setActionLoadingId(null);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast("Examination successfully deleted.");
      setExams((prev) => prev.filter((e) => e.id !== id));
    }
  }

  // Handle Status Update (e.g. Activate or End)
  async function handleStatusChange(id: string, newStatus: ExamStatus, actionLabel: string) {
    setActionLoadingId(id);
    const res = await updateExamStatusAction(id, newStatus);
    setActionLoadingId(null);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast(`Examination successfully marked as ${actionLabel}.`);
      setExams((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
      );
    }
  }

  // Handle Duplicate
  async function handleDuplicate(id: string) {
    setActionLoadingId(id);
    const res = await duplicateExamAction(id);
    setActionLoadingId(null);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast("Examination duplicated as a draft.");
      loadExams();
    }
  }

  // Computed Counts
  const totalCount = exams.length;
  const activeCount = exams.filter((e) => e.status === "ACTIVE").length;
  const scheduledCount = exams.filter((e) => e.status === "SCHEDULED").length;
  const draftCount = exams.filter((e) => e.status === "DRAFT").length;
  const completedCount = exams.filter((e) => e.status === "COMPLETED").length;

  // Filtered examinations
  const filteredExams = exams.filter((exam) => {
    // Status filter
    if (statusFilter !== "ALL" && exam.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = exam.title.toLowerCase().includes(q);
      const matchCode = (exam.courseCode || "").toLowerCase().includes(q);
      const matchPasscode = exam.passcode.toLowerCase().includes(q);
      return matchTitle || matchCode || matchPasscode;
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Examinations Hub
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              KARE PhD Registry
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Central repository of scheduled, live, completed, and drafted examination papers with integrated candidate hall ticket generation.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-shrink-0">
          <Link
            href="/admin/exams/new"
            className="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Examination
          </Link>
        </div>
      </div>

      {/* 2. Notifications Toast */}
      {toastMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 shadow-xs transition-all ${
            toastMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* 3. Executive Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Examinations
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-400">Authored papers</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              In Session (Active)
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-700">{activeCount}</span>
            <span className="text-xs text-slate-400">Live telemetry</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Scheduled Upcoming
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-700">{scheduledCount}</span>
            <span className="text-xs text-slate-400">Ready to sit</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Drafts in Database
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
              <Bookmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-700">{draftCount}</span>
            <span className="text-xs text-slate-400">In development</span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar & Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Segmented Tabs */}
        <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 space-x-1 overflow-x-auto">
          {[
            { id: "ALL", label: "All Papers", count: totalCount },
            { id: "SCHEDULED", label: "Scheduled", count: scheduledCount },
            { id: "ACTIVE", label: "In Session", count: activeCount },
            { id: "DRAFT", label: "Drafts", count: draftCount },
            { id: "COMPLETED", label: "Completed", count: completedCount },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as FilterStatus)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  isSelected
                    ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] sm:min-w-[280px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, code or passcode..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 5. Examinations List Cards */}
      {isLoading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center text-slate-500 text-xs font-semibold shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin text-blue-700 mx-auto mb-2" />
          Loading examinations repository...
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">No Examinations Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? `No examinations matched "${searchQuery}". Try adjusting your search query.`
                : statusFilter !== "ALL"
                ? `No examinations currently have the status "${statusFilter}".`
                : "Get started by creating your first multi-department PhD examination paper."}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/admin/exams/new"
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              Open Authoring Studio
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExams.map((exam) => {
            const isActing = actionLoadingId === exam.id;
            const isDraft = exam.status === "DRAFT";
            const isActive = exam.status === "ACTIVE";
            const isScheduled = exam.status === "SCHEDULED";
            const isCompleted = exam.status === "COMPLETED";

            return (
              <div
                key={exam.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Exam Info & Badges */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                          : isScheduled
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : isDraft
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-ping" />}
                      {exam.status === "ACTIVE"
                        ? "IN SESSION"
                        : exam.status === "SCHEDULED"
                        ? "SCHEDULED"
                        : exam.status === "DRAFT"
                        ? "DRAFT IN DB"
                        : exam.status}
                    </span>

                    {/* Course Code */}
                    {exam.courseCode && (
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {exam.courseCode}
                      </span>
                    )}

                    {/* Department Tracks Badges */}
                    {exam.targetDepartments.length > 0 ? (
                      <div className="flex items-center space-x-1">
                        {exam.targetDepartments.map((dept) => (
                          <span
                            key={dept}
                            className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200"
                          >
                            {dept}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Common Core</span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
                    {exam.title}
                  </h2>

                  {/* Quick Meta Row */}
                  <div className="flex items-center space-x-4 text-xs text-slate-500 flex-wrap gap-y-1">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.durationMinutes} Mins</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.totalQuestions} Questions</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.totalSections} Sections</span>
                    </div>

                    {/* Passcode Pill */}
                    <div className="flex items-center space-x-1.5 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 font-mono text-[11px] text-slate-700">
                      <KeyRound className="w-3 h-3 text-slate-400" />
                      <span className="font-bold">{exam.passcode}</span>
                      <button
                        type="button"
                        onClick={() => copyPasscode(exam.id, exam.passcode)}
                        className="text-slate-400 hover:text-blue-700 transition-colors ml-1 cursor-pointer"
                        title="Copy Passcode"
                      >
                        {copiedId === exam.id ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Contextual Action Buttons */}
                <div className="flex items-center space-x-2 self-start md:self-center flex-shrink-0">
                  {/* DRAFT Actions */}
                  {isDraft && (
                    <>
                      <Link
                        href={`/admin/exams/new?id=${exam.id}`}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        <span>Resume Draft</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(exam.id, exam.title)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        title="Delete Draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {/* SCHEDULED Actions */}
                  {isScheduled && (
                    <>
                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        <span>Details &amp; Slips</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(exam.id, "ACTIVE", "Active / In Session")}
                        disabled={isActing}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        title="Activate Examination for Candidate Sitting"
                      >
                        <Play className="w-3 h-3 mr-1 fill-current" />
                        <span>Activate Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(exam.id)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                        title="Duplicate as Draft"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(exam.id, exam.title)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        title="Delete Examination"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {/* ACTIVE Actions */}
                  {isActive && (
                    <>
                      <Link
                        href={`/admin/exams/${exam.id}/results`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                        title="Live Submissions & Gradebook"
                      >
                        <BarChart2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span>Results</span>
                      </Link>
                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        <span>Details</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(exam.id, "COMPLETED", "Completed")}
                        disabled={isActing}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        title="Conclude Examination Sitting"
                      >
                        <Square className="w-3 h-3 mr-1 fill-current" />
                        <span>End Exam</span>
                      </button>
                    </>
                  )}

                  {/* COMPLETED Actions */}
                  {isCompleted && (
                    <>
                      <Link
                        href={`/admin/exams/${exam.id}/results`}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                        title="View Gradebook & Candidate Submissions"
                      >
                        <BarChart2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span>Gradebook &amp; Results</span>
                      </Link>
                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        <span>View Records</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(exam.id)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                        title="Duplicate as New Draft"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

