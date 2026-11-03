"use client";

import React, { useState, useMemo, useEffect } from "react";
import { QuestionBankItem, QuestionState } from "../types";
import { Department } from "@/types/database.types";
import {
  X,
  Search,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface QuestionBankDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetSectionTitle: string;
  targetSectionId: string;
  targetDepartment?: string | null;
  targetLimit?: number;
  currentCount?: number;
  questionBank: QuestionBankItem[];
  departments?: Department[];
  existingQuestions: QuestionState[];
  onImport: (newQuestions: QuestionState[]) => void;
}

export function QuestionBankDrawer({
  isOpen,
  onClose,
  targetSectionTitle,
  targetSectionId,
  targetDepartment = null,
  targetLimit = 25,
  currentCount = 0,
  questionBank,
  departments = [],
  existingQuestions,
  onImport,
}: QuestionBankDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const availableSlots = Math.max(0, targetLimit - currentCount);

  // Automatically sync department filter when drawer opens with context
  useEffect(() => {
    if (isOpen) {
      if (targetDepartment) {
        setSelectedDeptFilter(targetDepartment.trim().toUpperCase());
      } else {
        setSelectedDeptFilter("GENERAL");
      }
      setSelectedIds(new Set());
      setSearchTerm("");
    }
  }, [isOpen, targetDepartment]);

  // Existing question prompts or bank IDs to detect duplicates
  const existingSourceIds = useMemo(() => {
    return new Set(
      existingQuestions
        .filter((q) => q.sourceQuestionId)
        .map((q) => q.sourceQuestionId!)
    );
  }, [existingQuestions]);

  // Extract unique departments present in bank, augmented with system departments
  const departmentsList = useMemo(() => {
    const map = new Map<string, string>();
    // Seed with departments passed from DB
    (departments || []).forEach((d) => {
      if (d.code) {
        map.set(d.code.trim().toUpperCase(), d.name);
      }
    });
    // Supplement with any departments found in question bank
    questionBank.forEach((q) => {
      if (q.department?.code) {
        const code = q.department.code.trim().toUpperCase();
        if (!map.has(code)) {
          map.set(code, q.department.name || code);
        }
      }
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [departments, questionBank]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questionBank.filter((q) => {
      // Search
      const searchLower = searchTerm.trim().toLowerCase();
      const matchesSearch =
        searchLower === "" ||
        q.prompt.toLowerCase().includes(searchLower) ||
        (q.topic && q.topic.toLowerCase().includes(searchLower)) ||
        q.options.some((opt) =>
          opt.option_text.toLowerCase().includes(searchLower)
        );

      // Dept filter
      let matchesDept = true;
      if (selectedDeptFilter === "GENERAL") {
        matchesDept = !q.department_id || !q.department;
      } else if (selectedDeptFilter !== "ALL") {
        const filterCode = selectedDeptFilter.trim().toUpperCase();
        const qCode = q.department?.code?.trim().toUpperCase();
        matchesDept = qCode === filterCode || q.department_id === selectedDeptFilter;
      }

      // Type filter
      let matchesType = true;
      if (selectedTypeFilter !== "ALL") {
        matchesType = q.question_type === selectedTypeFilter;
      }

      return matchesSearch && matchesDept && matchesType;
    });
  }, [questionBank, searchTerm, selectedDeptFilter, selectedTypeFilter]);

  // Selection handlers
  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= availableSlots) {
          alert(`Target limit reached: You can only select up to ${availableSlots} question(s) for this part (quota: ${targetLimit}).`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    const candidateIds = filteredQuestions
      .filter((q) => !existingSourceIds.has(q.id))
      .map((q) => q.id)
      .slice(0, availableSlots);
    setSelectedIds(new Set(candidateIds));
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  function handleConfirmImport() {
    if (selectedIds.size === 0) return;

    const itemsToImport = questionBank.filter((q) => selectedIds.has(q.id));

    const convertedQuestions: QuestionState[] = itemsToImport.map((q, idx) => ({
      id: `q-imported-${Date.now()}-${idx}`,
      sectionId: targetSectionId,
      targetDepartment: targetDepartment || null,
      questionType: q.question_type,
      prompt: q.prompt,
      codeSnippet: q.code_snippet || undefined,
      points: q.points || 1.0,
      negativePoints: q.negative_points || 0.0,
      orderIndex: existingQuestions.length + idx + 1,
      sourceQuestionId: q.id,
      sourceDepartment: q.department?.code || (q.department_id === null ? "GENERAL" : null),
      options: q.options.map((opt, optIdx) => ({
        id: `opt-imp-${Date.now()}-${idx}-${optIdx}`,
        text: opt.option_text,
        isCorrect: opt.is_correct,
        orderIndex: opt.order_index,
      })),
    }));

    onImport(convertedQuestions);
    setSelectedIds(new Set());
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Question Bank Importer
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-semibold truncate max-w-xs">
                  {targetSectionTitle}
                </span>
                {targetDepartment && (
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                    {targetDepartment}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Import from Master Question Repository
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 space-y-2.5 bg-white">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search questions by prompt or option..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all font-medium"
              />
            </div>

            {/* Department Filter */}
            <div className="sm:w-56">
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="ALL">All Repository Items</option>
                <option value="GENERAL">General Core (Common to All)</option>
                {departmentsList.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="sm:w-40">
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="ALL">All MCQ Types</option>
                <option value="MCQ_SINGLE">Single Choice</option>
                <option value="MCQ_MULTIPLE">Multi Select</option>
              </select>
            </div>
          </div>

          {/* Quick Select Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-0.5 gap-2">
            <div className="text-slate-500 font-medium text-[11px] flex items-center space-x-2">
              <span>
                Showing <strong className="text-slate-900">{filteredQuestions.length}</strong> items
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-blue-700">
                Quota: {currentCount} / {targetLimit} Qs
              </span>
              <span className="text-slate-300">•</span>
              <span className={`font-extrabold ${availableSlots === 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {availableSlots === 0 ? "Full Quota" : `${availableSlots} slots left`}
              </span>
              {selectedIds.size > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[10px]">
                  {selectedIds.size} of {availableSlots} selected
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={availableSlots <= 0}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Select Available ({availableSlots})
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/50">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-xs">
              <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-800">No Questions Found</h4>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                No items match your active filters ({selectedDeptFilter}). Try adjusting the filter or adding questions to this department in Question Bank.
              </p>
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isSelected = selectedIds.has(q.id);
              const isAlreadyInExam = existingSourceIds.has(q.id);
              const isQuotaFull = !isSelected && selectedIds.size >= availableSlots;

              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelection(q.id)}
                  className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer relative shadow-xs ${
                    isSelected
                      ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20"
                      : isQuotaFull
                      ? "border-slate-200 opacity-60 hover:opacity-80"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-blue-700 border-blue-700 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-500">#{idx + 1}</span>
                        {q.department ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                            {q.department.code}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                            General Core
                          </span>
                        )}

                        {q.topic && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[160px]">
                            {q.topic}
                          </span>
                        )}

                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          {q.question_type === "MCQ_SINGLE" ? "Single Choice" : "Multi Choice"}
                        </span>

                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {q.points} pt{q.points === 1 ? "" : "s"}
                        </span>

                        {isAlreadyInExam && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            In Exam
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Prompt */}
                  <p className="text-xs font-semibold text-slate-900 pl-6 leading-relaxed">
                    {q.prompt}
                  </p>

                  {/* Code Snippet Preview */}
                  {q.code_snippet && (
                    <div className="ml-6 mt-1.5 p-2 bg-slate-900 text-slate-100 rounded-lg font-mono text-[10px] overflow-x-auto">
                      <pre>{q.code_snippet}</pre>
                    </div>
                  )}

                  {/* Options List Preview */}
                  <div className="ml-6 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {q.options.map((opt, optIndex) => (
                      <div
                        key={opt.id}
                        className={`text-[11px] px-2 py-1 rounded-md flex items-center space-x-1.5 border ${
                          opt.is_correct
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center text-[9px] font-bold border border-current flex-shrink-0">
                          {String.fromCharCode(65 + optIndex)}
                        </span>
                        <span className="truncate">{opt.option_text}</span>
                        {opt.is_correct && (
                          <CheckCircle2 className="w-3 h-3 ml-auto text-emerald-600 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-[11px] text-slate-600 font-medium">
            Ready to import <strong className="text-blue-700 font-bold">{selectedIds.size}</strong> of{" "}
            <strong className="text-slate-900">{availableSlots}</strong> available question slots into{" "}
            <span className="font-semibold text-slate-900">{targetSectionTitle}</span>
            {targetDepartment && (
              <span className="ml-1 font-bold text-purple-700">({targetDepartment})</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedIds.size === 0 || selectedIds.size > availableSlots}
              className="inline-flex items-center px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Import ({selectedIds.size})
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
