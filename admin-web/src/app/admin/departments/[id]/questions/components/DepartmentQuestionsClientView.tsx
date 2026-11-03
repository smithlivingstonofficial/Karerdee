"use client";

import React, { useState } from "react";
import Link from "next/link";
import { QuestionModal } from "./QuestionModal";
import { BulkQuestionCsvModal } from "./BulkQuestionCsvModal";
import { deleteDepartmentQuestionAction } from "../actions";
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
  BookOpen
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
  const [modalOpen, setModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DepartmentQuestion | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

    return matchesSearch && matchesTopic && matchesDifficulty;
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
      setActionNotice({ type: "success", message: "Question removed from repository." });
    }
  }

  function handleOpenCreate() {
    setEditingQuestion(null);
    setModalOpen(true);
  }

  function handleOpenEdit(q: DepartmentQuestion) {
    setEditingQuestion(q);
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
            onClick={handleOpenCreate}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Question
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
          <div className="text-sm font-bold text-slate-900 mt-2 flex items-center space-x-3">
            <span className="inline-flex items-center text-xs">
              <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
              {singleChoiceCount} Single Choice
            </span>
            <span className="inline-flex items-center text-xs">
              <CheckCheck className="w-3.5 h-3.5 text-blue-600 mr-1" />
              {multiChoiceCount} Multi Choice
            </span>
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

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by question prompt, topic, code, or option..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all"
            />
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Difficulty:</span>
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              {["ALL", "EASY", "MEDIUM", "HARD"].map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedDifficulty === diff
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Topics Pills */}
        {topics.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Topics:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTopic("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedTopic === "ALL"
                  ? "bg-blue-700 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Topics ({initialQuestions.length})
            </button>
            {topics.map((t) => {
              const count = initialQuestions.filter((q) => q.topic === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTopic(t)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedTopic === t
                      ? "bg-blue-700 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((q, index) => {
            const diffColor =
              q.difficulty === "EASY"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : q.difficulty === "HARD"
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-blue-50 text-blue-700 border-blue-200";

            return (
              <div
                key={q.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-xs">
                      #{index + 1}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                      {q.topic}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${diffColor}`}>
                      {q.difficulty}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                      {q.question_type === "MCQ_SINGLE" ? "Single Choice" : "Multiple Choice"}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                      +{q.default_points} pts {q.default_negative_points > 0 && `(-${q.default_negative_points})`}
                    </span>
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
                  {q.prompt}
                </div>

                {/* Code Snippet */}
                {q.code_snippet && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 text-slate-100 p-3.5 font-mono text-xs">
                    <pre className="overflow-x-auto">{q.code_snippet}</pre>
                  </div>
                )}

                {/* Options List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {(q.options || []).map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    return (
                      <div
                        key={opt.id || optIdx}
                        className={`flex items-start space-x-2.5 p-2.5 rounded-xl border text-xs transition-colors ${
                          opt.is_correct
                            ? "bg-emerald-50/70 border-emerald-300 font-semibold text-emerald-950"
                            : "bg-slate-50/50 border-slate-200/80 text-slate-700"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 ${
                            opt.is_correct
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-slate-600 border border-slate-200"
                          }`}
                        >
                          {opt.is_correct ? <Check className="w-3 h-3 stroke-[3]" /> : letter}
                        </span>
                        <span className="flex-1 leading-snug">{opt.option_text}</span>
                        {opt.is_correct && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
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
                onClick={handleOpenCreate}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Add First Question
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <QuestionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        departmentId={department.id}
        departmentCode={department.code}
        existingTopics={topics}
        question={editingQuestion as any}
      />

      <BulkQuestionCsvModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        departmentId={department.id}
        departmentCode={department.code}
      />
    </div>
  );
}

