"use client";

import React, { useState } from "react";
import Link from "next/link";
import { QuestionModal } from "./QuestionModal";
import { BulkQuestionCsvModal } from "./BulkQuestionCsvModal";
import { deleteQuestionAction } from "../actions";
import { DepartmentQuestion, Department } from "@/types/database.types";
import {
  BookOpen,
  PlusCircle,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle2,
  Building2,
  Sparkles,
  Layers,
  HelpCircle,
  Check,
  CheckCheck,
  Globe,
  ChevronRight
} from "lucide-react";

interface QuestionsClientViewProps {
  initialQuestions: DepartmentQuestion[];
  departments: Department[];
}

export function QuestionsClientView({
  initialQuestions,
  departments,
}: QuestionsClientViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScope, setSelectedScope] = useState<string>("ALL"); // "ALL", "GENERAL", or dept.id
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");
  const [selectedFormat, setSelectedFormat] = useState<"ALL" | "MCQ_SINGLE" | "MCQ_MULTIPLE">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [initialModalType, setInitialModalType] = useState<"MCQ_SINGLE" | "MCQ_MULTIPLE">("MCQ_SINGLE");
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DepartmentQuestion | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Extract unique topics
  const topics = Array.from(new Set(initialQuestions.map((q) => q.topic || "General"))).sort();

  // Helper: detect Tamil research methodology question
  function isTamilQuestion(q: DepartmentQuestion): boolean {
    return Boolean(
      (q as any).language === "TA" ||
      (q.prompt && /[\u0B80-\u0BFF]/.test(q.prompt)) ||
      (q.topic && /tamil|தமிழ்/i.test(q.topic)) ||
      (q.department?.code === "TAM" || q.department?.code === "TAMIL")
    );
  }

  // Filter questions
  const filtered = initialQuestions.filter((q) => {
    const matchesSearch =
      q.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.code_snippet && q.code_snippet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q.department?.code && q.department.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q.options && q.options.some((o) => o.option_text.toLowerCase().includes(searchTerm.toLowerCase())));

    let matchesScope = true;
    if (selectedScope === "GENERAL" || selectedScope === "GENERAL_EN") {
      matchesScope = !q.department_id && !isTamilQuestion(q);
    } else if (selectedScope === "GENERAL_TA" || selectedScope === "COMMON_TAMIL") {
      matchesScope = !q.department_id && isTamilQuestion(q);
    } else if (selectedScope === "GENERAL_ALL") {
      matchesScope = !q.department_id;
    } else if (selectedScope !== "ALL") {
      matchesScope = q.department_id === selectedScope;
    }

    const matchesDifficulty = selectedDifficulty === "ALL" || q.difficulty === selectedDifficulty;
    const matchesFormat = selectedFormat === "ALL" || q.question_type === selectedFormat;

    return matchesSearch && matchesScope && matchesDifficulty && matchesFormat;
  });

  const commonTamilCount = initialQuestions.filter((q) => !q.department_id && isTamilQuestion(q)).length;
  const commonEnglishCount = initialQuestions.filter((q) => !q.department_id && !isTamilQuestion(q)).length;
  const generalCount = initialQuestions.filter((q) => !q.department_id).length;
  const deptSpecificCount = initialQuestions.filter((q) => !!q.department_id).length;
  const singleChoiceCount = initialQuestions.filter((q) => q.question_type === "MCQ_SINGLE").length;
  const multiChoiceCount = initialQuestions.filter((q) => q.question_type === "MCQ_MULTIPLE").length;

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this question from the master repository?")) return;
    setActionNotice(null);
    const res = await deleteQuestionAction(id);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setActionNotice({ type: "success", message: "Question removed from master repository." });
    }
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
    <div className="space-y-4 max-w-7xl mx-auto pb-12 w-full">
      {/* 1. Combined Executive Command Center & Question Bank KPI Cockpit */}
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
                  Master Question Bank
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                  Curricula Repository
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCsvModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bulk Import CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreate("MCQ_SINGLE")}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
              title="Author Question (Single Choice)"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Author Question</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreate("MCQ_MULTIPLE")}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 hover:border-amber-400 active:scale-[0.98] rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              title="Author Multi-Select Question (Multiple Correct Options)"
            >
              <CheckCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Multi-Select</span>
            </button>
          </div>
        </div>

        {/* 4 Clean Metric Cells (Zero Unwanted Text, Streamlined Padding) */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1: Total Master Bank */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Total Master Bank
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-slate-100 text-slate-600 border-slate-200">
                {initialQuestions.length} Items
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {initialQuestions.length}
              </span>
              <span className="text-xs text-slate-400">institutional questions</span>
            </div>
          </div>

          {/* Metric 2: General / Common Core */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-purple-700 transition-colors">
                General / Common Core
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                {generalCount} Core Items
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <button
                type="button"
                onClick={() => setSelectedScope(selectedScope === "GENERAL_EN" || selectedScope === "GENERAL" ? "ALL" : "GENERAL_EN")}
                className={`text-xs font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer inline-flex items-center ${
                  selectedScope === "GENERAL_EN" || selectedScope === "GENERAL"
                    ? "bg-purple-100 text-purple-900 border-purple-300 ring-2 ring-purple-500/20 shadow-2xs font-extrabold"
                    : "text-purple-700 hover:bg-purple-50 border-purple-200"
                }`}
                title="Filter by English General Core"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                {commonEnglishCount} English
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => setSelectedScope(selectedScope === "GENERAL_TA" ? "ALL" : "GENERAL_TA")}
                className={`text-xs font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer inline-flex items-center ${
                  selectedScope === "GENERAL_TA"
                    ? "bg-indigo-100 text-indigo-900 border-indigo-300 ring-2 ring-indigo-500/20 shadow-2xs font-extrabold"
                    : "text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                }`}
                title="Filter by Common Tamil"
              >
                <Globe className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                {commonTamilCount} Tamil
              </button>
            </div>
          </div>

          {/* Metric 3: Department Curricula */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                Department Curricula
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                {departments.length} Faculties
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-emerald-700 tracking-tight">
                {deptSpecificCount}
              </span>
              <span className="text-xs text-slate-400">specialized items</span>
            </div>
          </div>

          {/* Metric 4: Question Formats */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-700 transition-colors">
                Question Formats
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-indigo-50 text-indigo-700 border-indigo-200">
                MCQ Formats
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <button
                type="button"
                onClick={() => setSelectedFormat(selectedFormat === "MCQ_SINGLE" ? "ALL" : "MCQ_SINGLE")}
                className={`text-xs font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer inline-flex items-center ${
                  selectedFormat === "MCQ_SINGLE"
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs"
                    : "text-slate-900 hover:bg-slate-100 border-transparent"
                }`}
                title="Filter by Single Choice MCQs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                {singleChoiceCount} Single
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => setSelectedFormat(selectedFormat === "MCQ_MULTIPLE" ? "ALL" : "MCQ_MULTIPLE")}
                className={`text-xs font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer inline-flex items-center ${
                  selectedFormat === "MCQ_MULTIPLE"
                    ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-500/20 shadow-2xs"
                    : "text-slate-900 hover:bg-slate-100 border-transparent"
                }`}
                title="Filter by Multi-Select MCQs"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-600 mr-1" />
                {multiChoiceCount} Multi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in shadow-2xs ${
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

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by prompt, topic, code, or option..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-700 px-1 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Format Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Format:</span>
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 text-xs font-semibold text-slate-600">
              {[
                { id: "ALL", label: "ALL" },
                { id: "MCQ_SINGLE", label: `Single (${singleChoiceCount})` },
                { id: "MCQ_MULTIPLE", label: `Multi-Select (${multiChoiceCount})` },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setSelectedFormat(fmt.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedFormat === fmt.id
                      ? "bg-white text-blue-700 shadow-xs font-bold border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/40 font-medium"
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Difficulty:</span>
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 text-xs font-semibold text-slate-600">
              {["ALL", "EASY", "MEDIUM", "HARD"].map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedDifficulty === diff
                      ? "bg-white text-blue-700 shadow-xs font-bold border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/40 font-medium"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope Tabs (All, General, and individual departments) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 border-t border-slate-100 scrollbar-none text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Scope:
          </span>
          <button
            type="button"
            onClick={() => setSelectedScope("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedScope === "ALL"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Questions ({initialQuestions.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedScope("GENERAL_EN")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center space-x-1 ${
              selectedScope === "GENERAL_EN" || selectedScope === "GENERAL"
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            }`}
            title="Filter by Universal General Core questions (English)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>General Core ({commonEnglishCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedScope("GENERAL_TA")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center space-x-1.5 ${
              selectedScope === "GENERAL_TA"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
            }`}
            title="Filter by Common Tamil research methodology questions (Tamil Dept)"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            <span>Common Tamil ({commonTamilCount})</span>
          </button>

          {departments.map((d) => {
            const count = initialQuestions.filter((q) => q.department_id === d.id).length;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedScope(d.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedScope === d.id
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d.code} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((q, index) => {
            const isGeneral = !q.department_id;
            const diffColor =
              q.difficulty === "EASY"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : q.difficulty === "HARD"
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-blue-50 text-blue-700 border-blue-200";

            return (
              <div
                key={q.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all space-y-3.5 group"
              >
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-xs border border-slate-200/80">
                      #{index + 1}
                    </span>

                    {/* Scope Badge */}
                    {isGeneral ? (
                      isTamilQuestion(q) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                          <Globe className="w-3 h-3 mr-1 text-indigo-600" />
                          Common Tamil
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <Sparkles className="w-3 h-3 mr-1" />
                          General Core
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {q.department?.code || "DEPT"}
                      </span>
                    )}

                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                      {q.topic}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${diffColor}`}>
                      {q.difficulty}
                    </span>
                    {q.question_type === "MCQ_MULTIPLE" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                        <CheckCheck className="w-3 h-3 mr-1 text-amber-600" />
                        Multi-Select
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                        <Check className="w-3 h-3 mr-1 text-emerald-600" />
                        Single Choice
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 self-end sm:self-center">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                      1 Mark {q.default_negative_points > 0 && `(-${q.default_negative_points})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                      title="Edit Question"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-line">
                  {q.prompt}
                </div>

                {/* Code Snippet */}
                {q.code_snippet && (
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 p-3.5 font-mono text-xs">
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
                              : "bg-emerald-50/80 border-emerald-300 font-semibold text-emerald-950 shadow-2xs"
                            : "bg-slate-50/60 hover:bg-slate-50 border-slate-200/80 text-slate-700"
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
                              : "bg-white text-slate-600 border border-slate-200 shadow-2xs"
                          }`}
                        >
                          {opt.is_correct ? (
                            isMulti ? <CheckCheck className="w-3 h-3 stroke-[3]" /> : <Check className="w-3 h-3 stroke-[3]" />
                          ) : (
                            letter
                          )}
                        </span>
                        <span className="flex-1 leading-snug">{opt.option_text}</span>
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
              {searchTerm || selectedScope !== "ALL" || selectedDifficulty !== "ALL"
                ? "No matching questions found"
                : "Master Question Bank is Empty"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || selectedScope !== "ALL" || selectedDifficulty !== "ALL"
                ? "Try adjusting your search criteria, scope, or difficulty filter."
                : "Author General Questions for Ph.D entrance / Common sections or upload questions for departments in bulk via CSV."}
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
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Author First Question
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <QuestionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        departments={departments}
        existingTopics={topics}
        initialType={initialModalType}
        question={editingQuestion as any}
      />

      <BulkQuestionCsvModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        validDepartmentCodes={departments.map((d) => d.code)}
      />
    </div>
  );
}

