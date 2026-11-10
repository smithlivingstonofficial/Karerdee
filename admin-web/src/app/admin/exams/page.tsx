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
  Radio,
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
    <div className="space-y-4 max-w-7xl mx-auto pb-12 w-full">
      {/* 1. Combined Executive Command Center & Examinations KPI Cockpit */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
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
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Examinations Hub
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                  PhD Registry
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {activeCount > 0 && (
              <Link
                href="/admin/proctoring"
                className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 rounded-lg shadow-2xs transition-all cursor-pointer group"
                title="Open Live Proctoring & Security Telemetry Grid"
              >
                <Radio className="w-3.5 h-3.5 mr-1.5 text-emerald-600 animate-pulse" />
                <span>Live Invigilation</span>
                <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-black shadow-2xs">
                  {activeCount}
                </span>
              </Link>
            )}

            <Link
              href="/admin/exams/new"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Examination</span>
            </Link>
          </div>
        </div>

        {/* 4 Clean Metric Cells (Zero Unwanted Text, Streamlined Padding) */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1: Total Examinations */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Total Exams
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-slate-100 text-slate-600 border-slate-200">
                {totalCount} Total
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {totalCount}
              </span>
              <span className="text-xs text-slate-400">authored papers</span>
            </div>
          </div>

          {/* Metric 2: In Session */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                In Session
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] flex items-center space-x-1 ${
                  activeCount > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {activeCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping mr-0.5" />
                )}
                <span>{activeCount > 0 ? "Running" : "Idle"}</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {activeCount}
              </span>
              <span className="text-xs text-slate-400">live telemetry</span>
            </div>
          </div>

          {/* Metric 3: Scheduled Upcoming */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-700 transition-colors">
                Scheduled
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  scheduledCount > 0
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {scheduledCount > 0 ? "Upcoming" : "None"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {scheduledCount}
              </span>
              <span className="text-xs text-slate-400">ready to sit</span>
            </div>
          </div>

          {/* Metric 4: Drafts in Database */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                Drafts in DB
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  draftCount > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {draftCount > 0 ? "In dev" : "Clean"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {draftCount}
              </span>
              <span className="text-xs text-slate-400">unpublished</span>
            </div>
          </div>
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

      {/* 3. Segmented Filter Toolbar & Filter Search */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Segmented Tabs */}
        <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 space-x-1 overflow-x-auto text-xs font-semibold text-slate-600">
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
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  isSelected
                    ? "bg-white text-blue-700 shadow-xs font-bold border border-slate-200/60"
                    : "hover:text-slate-900 hover:bg-white/40 font-medium"
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
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, code or passcode..."
            className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-700 px-1 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Examinations List Cards */}
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
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Open Authoring Studio</span>
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
            const isCopied = copiedId === exam.id;

            return (
              <div
                key={exam.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left: Exam Info & Badges */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    {/* Status Badge with colored dot */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border shadow-2xs ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/90"
                          : isScheduled
                          ? "bg-blue-50 text-blue-700 border-blue-200/90"
                          : isDraft
                          ? "bg-amber-50 text-amber-800 border-amber-200/90"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          isActive
                            ? "bg-emerald-600 animate-pulse"
                            : isScheduled
                            ? "bg-blue-600"
                            : isDraft
                            ? "bg-amber-600"
                            : "bg-slate-400"
                        }`}
                      />
                      {isActive
                        ? "IN SESSION"
                        : isScheduled
                        ? "SCHEDULED"
                        : isDraft
                        ? "DRAFT IN DB"
                        : "CONCLUDED"}
                    </span>

                    {/* Course Code */}
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/80">
                      {exam.courseCode || "GEN-CORE"}
                    </span>

                    {/* Department Tracks Badges */}
                    {exam.targetDepartments && exam.targetDepartments.length > 0 ? (
                      <div className="flex items-center space-x-1">
                        {exam.targetDepartments.map((dept) => (
                          <span
                            key={dept}
                            className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/60"
                          >
                            {dept}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Common Core</span>
                    )}

                    {/* Strikes Indicator */}
                    <span className="text-[10px] font-medium text-slate-400">
                      • {exam.maxStrikes} Strikes Max
                    </span>
                  </div>

                  {/* Title */}
                  <Link
                    href={`/admin/exams/${exam.id}`}
                    className="text-base font-bold text-slate-900 tracking-tight truncate block hover:text-blue-600 transition-colors"
                  >
                    {exam.title}
                  </Link>

                  {/* Quick Meta Row */}
                  <div className="flex items-center space-x-3.5 text-xs text-slate-500 flex-wrap gap-y-1.5 pt-0.5">
                    <div className="flex items-center space-x-1.5 font-medium text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.durationMinutes} Mins</span>
                    </div>

                    <div className="flex items-center space-x-1.5 font-medium text-slate-600">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.totalQuestions} Questions</span>
                    </div>

                    <div className="flex items-center space-x-1.5 font-medium text-slate-600">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.totalSections} Sections</span>
                    </div>

                    {/* Passcode Voucher Token */}
                    <button
                      type="button"
                      onClick={() => copyPasscode(exam.id, exam.passcode)}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border font-mono font-bold text-xs transition-all cursor-pointer shadow-2xs group/btn ${
                        isCopied
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800 hover:border-slate-300"
                      }`}
                      title="Click to copy passcode"
                    >
                      <KeyRound className="w-3 h-3 text-slate-400 group-hover/btn:text-blue-600" />
                      <span>{exam.passcode}</span>
                      {isCopied ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 animate-in fade-in" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 group-hover/btn:text-blue-600 transition-colors" />
                      )}
                      {isCopied && (
                        <span className="text-[9px] text-emerald-600 font-bold ml-0.5">
                          Copied
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right: Contextual Action Buttons */}
                <div className="flex items-center space-x-2 self-start md:self-center flex-shrink-0">
                  {/* DRAFT Actions */}
                  {isDraft && (
                    <>
                      <Link
                        href={`/admin/exams/new?id=${exam.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <span>Resume Draft</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1 text-amber-600" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(exam.id, exam.title)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        title="Delete Draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* SCHEDULED Actions */}
                  {isScheduled && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(exam.id, "ACTIVE", "Active / In Session")}
                        disabled={isActing}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        title="Activate Examination for Candidate Sitting"
                      >
                        <Play className="w-3 h-3 mr-1 fill-current" />
                        <span>Activate Now</span>
                      </button>

                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>Details &amp; Slips</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(exam.id)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer"
                        title="Duplicate as Draft"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(exam.id, exam.title)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        title="Delete Examination"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* ACTIVE Actions */}
                  {isActive && (
                    <>
                      <Link
                        href="/admin/proctoring"
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                        title="Enter Live Proctoring Stream"
                      >
                        <Radio className="w-3.5 h-3.5 fill-current animate-pulse mr-1" />
                        <span>Invigilate</span>
                      </Link>

                      <Link
                        href={`/admin/exams/${exam.id}/results`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                        title="Live Submissions & Gradebook"
                      >
                        <BarChart2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span>Results</span>
                      </Link>

                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>Details</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(exam.id, "COMPLETED", "Completed")}
                        disabled={isActing}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        title="Conclude Examination Sitting"
                      >
                        <Square className="w-3 h-3 mr-1 fill-current text-slate-500" />
                        <span>End Exam</span>
                      </button>
                    </>
                  )}

                  {/* COMPLETED Actions */}
                  {isCompleted && (
                    <>
                      <Link
                        href={`/admin/exams/${exam.id}/results`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                        title="View Gradebook & Candidate Submissions"
                      >
                        <BarChart2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span>Gradebook &amp; Results</span>
                      </Link>

                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>View Records</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(exam.id)}
                        disabled={isActing}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer"
                        title="Duplicate as New Draft"
                      >
                        <Copy className="w-3.5 h-3.5" />
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

