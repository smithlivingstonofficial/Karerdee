"use client";

import React, { useState } from "react";
import Link from "next/link";
import { QuestionModal } from "./QuestionModal";
import { BulkQuestionCsvModal } from "./BulkQuestionCsvModal";
import { BulkDeleteConfirmModal } from "@/app/admin/questions/components/BulkDeleteConfirmModal";
import { exportQuestionsToCsv } from "@/lib/exportQuestionsCsv";
import { MathText } from "@/components/MathText";
import { isBogusDepartmentSnippet } from "@/lib/snippets";
import {
  deleteDepartmentQuestionAction,
  bulkDeleteDepartmentQuestionsAction,
  duplicateDepartmentQuestionAction,
  bulkUpdateDepartmentQuestionsDifficultyAction,
  bulkUpdateDepartmentQuestionsFormatAction,
} from "../actions";
import { DepartmentQuestion } from "@/types/database.types";
import {
  Building2,
  PlusCircle,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Code,
  Layers,
  HelpCircle,
  Check,
  CheckCheck,
  BookOpen,
  Copy,
  Download,
  Sliders,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Loader2,
} from "lucide-react";

interface DepartmentQuestionsClientViewProps {
  department: {
    id: string;
    name: string;
    code: string;
  };
  initialQuestions: DepartmentQuestion[];
}

export function DepartmentQuestionsClientView({
  department,
  initialQuestions,
}: DepartmentQuestionsClientViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("ALL");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");
  const [selectedFormat, setSelectedFormat] = useState<"ALL" | "MCQ_SINGLE" | "MCQ_MULTIPLE">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [initialModalType, setInitialModalType] = useState<"MCQ_SINGLE" | "MCQ_MULTIPLE">("MCQ_SINGLE");
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DepartmentQuestion | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Multi-question selection & batch management state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // Extract unique topics
  const topics = Array.from(new Set(initialQuestions.map((q) => q.topic || "General"))).sort();

  // Filter questions
  const filtered = initialQuestions.filter((q) => {
    const matchesSearch =
      q.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.code_snippet && q.code_snippet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q.options && q.options.some((o) => o.option_text.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesTopic = selectedTopic === "ALL" || q.topic === selectedTopic;
    const matchesDifficulty = selectedDifficulty === "ALL" || q.difficulty === selectedDifficulty;
    const matchesFormat = selectedFormat === "ALL" || q.question_type === selectedFormat;

    return matchesSearch && matchesTopic && matchesDifficulty && matchesFormat;
  });

  const singleChoiceCount = initialQuestions.filter((q) => q.question_type === "MCQ_SINGLE").length;
  const multiChoiceCount = initialQuestions.filter((q) => q.question_type === "MCQ_MULTIPLE").length;

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this question from the repository?")) return;
    setActionNotice(null);
    const res = await deleteDepartmentQuestionAction(id, department.id);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setActionNotice({ type: "success", message: "Question removed from repository." });
    }
  }

  // Multi-Selection Logic
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const isAllFilteredSelected = filtered.length > 0 && filtered.every((q) => selectedIds.has(q.id));
  const isSomeFilteredSelected = filtered.some((q) => selectedIds.has(q.id)) && !isAllFilteredSelected;

  function toggleSelectAllFiltered() {
    if (isAllFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((q) => next.delete(q.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((q) => next.add(q.id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Question Duplication
  async function handleDuplicate(id: string) {
    setActionNotice(null);
    setIsBulkOperating(true);
    const res = await duplicateDepartmentQuestionAction(id, department.id);
    setIsBulkOperating(false);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setActionNotice({ type: "success", message: "Question duplicated successfully." });
    }
  }

  // Bulk Operations Handlers
  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkOperating(true);
    const res = await bulkDeleteDepartmentQuestionsAction(ids, department.id);
    setIsBulkOperating(false);
    setBulkDeleteModalOpen(false);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      clearSelection();
      setActionNotice({
        type: "success",
        message: `Successfully deleted ${res.count || ids.length} questions from ${department.code} repository.`,
      });
    }
  }

  async function handleBulkDifficulty(diff: "EASY" | "MEDIUM" | "HARD") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkOperating(true);
    const res = await bulkUpdateDepartmentQuestionsDifficultyAction(ids, department.id, diff);
    setIsBulkOperating(false);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setActionNotice({
        type: "success",
        message: `Updated difficulty to ${diff} for ${res.count || ids.length} questions.`,
      });
    }
  }

  async function handleBulkFormat(fmt: "MCQ_SINGLE" | "MCQ_MULTIPLE") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkOperating(true);
    const res = await bulkUpdateDepartmentQuestionsFormatAction(ids, department.id, fmt);
    setIsBulkOperating(false);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setActionNotice({
        type: "success",
        message: `Updated format to ${fmt === "MCQ_MULTIPLE" ? "Multi-Select" : "Single Choice"} for ${res.count || ids.length} questions.`,
      });
    }
  }

  // CSV Exports
  function handleExportSelectedCsv() {
    const questionsToExport = initialQuestions.filter((q) => selectedIds.has(q.id));
    if (questionsToExport.length === 0) return;
    exportQuestionsToCsv(questionsToExport, department.code, `${department.code}_selected_${questionsToExport.length}_questions`);
  }

  function handleExportFilteredCsv() {
    if (filtered.length === 0) return;
    exportQuestionsToCsv(filtered, department.code, `${department.code}_questions`);
  }

  function handleOpenCreate(type: "MCQ_SINGLE" | "MCQ_MULTIPLE" = "MCQ_SINGLE") {
    setEditingQuestion(null);
    setInitialModalType(type);
    setModalOpen(true);
  }

  function handleOpenEdit(q: DepartmentQuestion) {
    setEditingQuestion(q);
    setInitialModalType(q.question_type || "MCQ_SINGLE");
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-slate-500">
        <Link href="/admin" className="hover:text-blue-700 transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/admin/departments" className="hover:text-blue-700 transition-colors">
          Departments
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 truncate">
          [{department.code}] Question Bank
        </span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex items-start space-x-3.5">
          <Link
            href="/admin/departments"
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors mt-0.5"
            title="Back to Departments"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {department.name}
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {department.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Curated department question repository used for multi-department exam section authoring.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Bulk Import CSV
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreate("MCQ_SINGLE")}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Author Single Choice Question"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Question
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreate("MCQ_MULTIPLE")}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Author Multi-Select Question"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
            + Multi-Select
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Questions in Bank</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {initialQuestions.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ready for exam paper inclusion
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Question Types</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 mt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setSelectedFormat(selectedFormat === "MCQ_SINGLE" ? "ALL" : "MCQ_SINGLE")}
              className={`inline-flex items-center text-xs px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                selectedFormat === "MCQ_SINGLE"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs"
                  : "text-slate-900 hover:bg-slate-100 border-transparent"
              }`}
              title="Filter by Single Choice"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
              {singleChoiceCount} Single Choice
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => setSelectedFormat(selectedFormat === "MCQ_MULTIPLE" ? "ALL" : "MCQ_MULTIPLE")}
              className={`inline-flex items-center text-xs px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                selectedFormat === "MCQ_MULTIPLE"
                  ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-500/20 shadow-2xs"
                  : "text-slate-900 hover:bg-slate-100 border-transparent"
              }`}
              title="Filter by Multi-Select"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-600 mr-1" />
              {multiChoiceCount} Multi Choice
            </button>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Standard MCQ single and multiple selection
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Syllabus Topics</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {topics.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Categorized academic units
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Control Hub: Topics Navigator & Search/Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Tier 1: Topics Navigator */}
        {topics.length > 0 && (
          <div className="bg-slate-50/80 border-b border-slate-200/80 px-4 py-2.5 sm:px-5 sm:py-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Topics:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTopic("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center space-x-1.5 ${
                selectedTopic === "ALL"
                  ? "bg-blue-700 text-white shadow-2xs"
                  : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-100"
              }`}
            >
              <span>All Topics</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedTopic === "ALL" ? "bg-blue-800 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {initialQuestions.length}
              </span>
            </button>
            {topics.map((t) => {
              const count = initialQuestions.filter((q) => q.topic === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTopic(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center space-x-1.5 ${
                    selectedTopic === t
                      ? "bg-blue-700 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-100"
                  }`}
                >
                  <span>{t}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedTopic === t ? "bg-blue-800 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tier 2: Search Box & Filters */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Prominent Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by prompt, topic, code, or option text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 focus:bg-white transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-700 px-1 font-bold cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right Filters & CSV Export Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Format Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Format
              </span>
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/90 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedFormat("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedFormat === "ALL"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFormat("MCQ_SINGLE")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center space-x-1 ${
                    selectedFormat === "MCQ_SINGLE"
                      ? "bg-white text-emerald-800 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Single</span>
                  <span className="text-[10px] text-slate-400 ml-0.5 font-normal">({singleChoiceCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFormat("MCQ_MULTIPLE")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center space-x-1 ${
                    selectedFormat === "MCQ_MULTIPLE"
                      ? "bg-white text-amber-800 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CheckCheck className="w-3 h-3 text-amber-600" />
                  <span>Multi</span>
                  <span className="text-[10px] text-slate-400 ml-0.5 font-normal">({multiChoiceCount})</span>
                </button>
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Difficulty
              </span>
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/90 text-xs shadow-2xs">
                {[
                  { id: "ALL", label: "All" },
                  { id: "EASY", label: "Easy", activeCls: "text-emerald-700 font-bold" },
                  { id: "MEDIUM", label: "Med", activeCls: "text-blue-700 font-bold" },
                  { id: "HARD", label: "Hard", activeCls: "text-red-700 font-bold" },
                ].map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => setSelectedDifficulty(diff.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedDifficulty === diff.id
                        ? `bg-white shadow-2xs ${diff.activeCls || "text-slate-900 font-bold"}`
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Filtered CSV */}
            <button
              type="button"
              onClick={handleExportFilteredCsv}
              disabled={filtered.length === 0}
              className={`h-8.5 px-3 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-all shadow-2xs border ${
                filtered.length > 0
                  ? "bg-white hover:bg-emerald-50 text-emerald-800 border-slate-200 hover:border-emerald-300 cursor-pointer active:scale-95"
                  : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
              }`}
              title={filtered.length > 0 ? `Export all ${filtered.length} filtered questions to CSV` : "No questions to export"}
            >
              <Download className={`w-3.5 h-3.5 ${filtered.length > 0 ? "text-emerald-600" : "text-slate-400"}`} />
              <span>Export CSV</span>
              {filtered.length > 0 && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                  {filtered.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stream Subheader & Quick Select */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 py-1">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-bold text-slate-800">
            Showing {filtered.length} {filtered.length === 1 ? "question" : "questions"} in {department.code}
          </span>
          {(searchTerm || selectedTopic !== "ALL" || selectedFormat !== "ALL" || selectedDifficulty !== "ALL") && (
            <>
              <span className="text-slate-300">•</span>
              {selectedTopic !== "ALL" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                  Topic: {selectedTopic}
                  <button type="button" onClick={() => setSelectedTopic("ALL")} className="ml-1 hover:text-blue-950 font-bold cursor-pointer">✕</button>
                </span>
              )}
              {selectedFormat !== "ALL" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  Format: {selectedFormat === "MCQ_MULTIPLE" ? "Multi-Select" : "Single Choice"}
                  <button type="button" onClick={() => setSelectedFormat("ALL")} className="ml-1 hover:text-slate-950 font-bold cursor-pointer">✕</button>
                </span>
              )}
              {selectedDifficulty !== "ALL" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  Diff: {selectedDifficulty}
                  <button type="button" onClick={() => setSelectedDifficulty("ALL")} className="ml-1 hover:text-slate-950 font-bold cursor-pointer">✕</button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  Query: &ldquo;{searchTerm}&rdquo;
                  <button type="button" onClick={() => setSearchTerm("")} className="ml-1 hover:text-slate-950 font-bold cursor-pointer">✕</button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedTopic("ALL");
                  setSelectedFormat("ALL");
                  setSelectedDifficulty("ALL");
                  setSearchTerm("");
                }}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline decoration-dotted ml-1 cursor-pointer"
              >
                Reset All
              </button>
            </>
          )}
        </div>

        {/* Right: Quick Select All Filtered */}
        {filtered.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center cursor-pointer border shadow-2xs ${
                isAllFilteredSelected
                  ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                  : selectedIds.size > 0
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
              title="Select or deselect all visible filtered questions"
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" />
              ) : selectedIds.size > 0 ? (
                <MinusSquare className="w-3.5 h-3.5 mr-1.5 text-blue-700 stroke-[2.5]" />
              ) : (
                <Square className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              )}
              <span>
                {isAllFilteredSelected
                  ? "Deselect All Filtered"
                  : selectedIds.size > 0
                  ? `${selectedIds.size} Selected • Select Rest`
                  : `Select All (${filtered.length})`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((q, index) => {
            const isSelected = selectedIds.has(q.id);
            const diffColor =
              q.difficulty === "EASY"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : q.difficulty === "HARD"
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-blue-50 text-blue-700 border-blue-200";

            return (
              <div
                key={q.id}
                className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-xs transition-all space-y-4 ${
                  isSelected
                    ? "border-blue-400 ring-2 ring-blue-500/25 bg-blue-50/15 shadow-sm"
                    : "border-slate-200/90 hover:border-slate-300"
                }`}
              >
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(q.id)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border flex-shrink-0 ${
                        isSelected
                          ? "bg-blue-700 border-blue-700 text-white shadow-2xs"
                          : "bg-white hover:bg-slate-100 border-slate-300 text-transparent hover:text-slate-300"
                      }`}
                      title={isSelected ? "Deselect question" : "Select question"}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-xs">
                      #{index + 1}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                      {q.topic}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${diffColor}`}>
                      {q.difficulty}
                    </span>
                    {q.question_type === "MCQ_MULTIPLE" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                        <CheckCheck className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Multi-Select
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Single Choice
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 self-end sm:self-center">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      1 Mark {q.default_negative_points > 0 && `(-${q.default_negative_points})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(q.id)}
                      disabled={isBulkOperating}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                      title="Duplicate Question"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Edit Question"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-line">
                  <MathText text={q.prompt} />
                </div>

                {/* Code Snippet */}
                {q.code_snippet && !isBogusDepartmentSnippet(q.code_snippet, department.code) && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 text-slate-100 p-3.5 font-mono text-xs">
                    <pre className="overflow-x-auto">{q.code_snippet}</pre>
                  </div>
                )}

                {/* Options List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {(q.options || []).map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isMulti = q.question_type === "MCQ_MULTIPLE";
                    return (
                      <div
                        key={opt.id || optIdx}
                        className={`flex items-start space-x-2.5 p-2.5 rounded-xl border text-xs transition-colors ${
                          opt.is_correct
                            ? isMulti
                              ? "bg-amber-50/70 border-amber-300 font-semibold text-amber-950 shadow-2xs"
                              : "bg-emerald-50/70 border-emerald-300 font-semibold text-emerald-950 shadow-2xs"
                            : "bg-slate-50/50 border-slate-200/80 text-slate-700"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 ${
                            isMulti ? "rounded-md" : "rounded-full"
                          } ${
                            opt.is_correct
                              ? isMulti
                                ? "bg-amber-600 text-white shadow-2xs"
                                : "bg-emerald-600 text-white shadow-2xs"
                              : "bg-white text-slate-600 border border-slate-200"
                          }`}
                        >
                          {opt.is_correct ? (
                            isMulti ? <CheckCheck className="w-3 h-3 stroke-[3]" /> : <Check className="w-3 h-3 stroke-[3]" />
                          ) : (
                            letter
                          )}
                        </span>
                        <MathText className="flex-1 leading-snug" text={opt.option_text} />
                        {opt.is_correct && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            isMulti
                              ? "text-amber-800 bg-amber-100/70 border-amber-300"
                              : "text-emerald-700 bg-emerald-100/70 border-emerald-200"
                          }`}>
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto border border-blue-100">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchTerm || selectedTopic !== "ALL" || selectedDifficulty !== "ALL"
                ? "No matching questions found"
                : `No questions in ${department.code} repository yet`}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || selectedTopic !== "ALL" || selectedDifficulty !== "ALL"
                ? "Try adjusting your search criteria, topic, or difficulty filter."
                : `Start populating the ${department.code} question bank. Faculty can add individual MCQs or bulk import questions using CSV.`}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Upload CSV
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreate("MCQ_SINGLE")}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Add First Question
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Operations Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 inset-x-0 mx-auto max-w-4xl z-40 px-4 animate-in slide-in-from-bottom-5">
          <div className="bg-white/95 backdrop-blur-md border border-slate-300 shadow-2xl rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Count & Select All */}
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-700 text-white shadow-xs">
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                {selectedIds.size} Selected
              </span>
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="text-xs font-semibold text-slate-700 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isAllFilteredSelected ? "Deselect Filtered" : `Select All Filtered (${filtered.length})`}
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Bulk Difficulty Dropdown */}
              <div className="relative group">
                <button
                  type="button"
                  className="inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  <span>Difficulty ▾</span>
                </button>
                <div className="absolute bottom-full mb-1 left-0 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-xl shadow-lg p-1 min-w-[120px] z-50">
                  <button
                    type="button"
                    onClick={() => handleBulkDifficulty("EASY")}
                    className="text-left px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                  >
                    Set Easy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkDifficulty("MEDIUM")}
                    className="text-left px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                  >
                    Set Medium
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkDifficulty("HARD")}
                    className="text-left px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    Set Hard
                  </button>
                </div>
              </div>

              {/* Bulk Format Dropdown */}
              <div className="relative group">
                <button
                  type="button"
                  className="inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                  <span>Format ▾</span>
                </button>
                <div className="absolute bottom-full mb-1 left-0 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-xl shadow-lg p-1 min-w-[140px] z-50">
                  <button
                    type="button"
                    onClick={() => handleBulkFormat("MCQ_SINGLE")}
                    className="text-left px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    Single Choice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkFormat("MCQ_MULTIPLE")}
                    className="text-left px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                  >
                    Multi-Select
                  </button>
                </div>
              </div>

              {/* Export Selected to CSV */}
              <button
                type="button"
                onClick={handleExportSelectedCsv}
                className="inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                title="Export selected questions to CSV"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              {/* Bulk Delete */}
              <button
                type="button"
                onClick={() => setBulkDeleteModalOpen(true)}
                disabled={isBulkOperating}
                className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Delete selected questions"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-red-600" />
                <span>Delete ({selectedIds.size})</span>
              </button>

              {/* Clear Selection */}
              <button
                type="button"
                onClick={clearSelection}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <QuestionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        departmentId={department.id}
        departmentCode={department.code}
        existingTopics={topics}
        initialType={initialModalType}
        question={editingQuestion as any}
      />

      <BulkQuestionCsvModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        departmentId={department.id}
        departmentCode={department.code}
      />

      <BulkDeleteConfirmModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        selectedQuestions={initialQuestions.filter((q) => selectedIds.has(q.id))}
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={isBulkOperating}
      />
    </div>
  );
}

