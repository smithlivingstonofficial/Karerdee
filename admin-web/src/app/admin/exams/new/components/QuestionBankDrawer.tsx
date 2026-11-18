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
  Lock,
  ExternalLink,
  Upload,
  AlertTriangle,
  ShieldCheck,
  Check,
  Filter,
  Building2,
  Globe,
  Tag,
  Layers,
  Award,
} from "lucide-react";

interface QuestionBankDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetSectionTitle: string;
  targetSectionId: string;
  targetDepartment?: string | null;
  targetDepartmentName?: string | null;
  targetLimit?: number;
  currentCount?: number;
  questionBank: QuestionBankItem[];
  departments?: Department[];
  existingQuestions: QuestionState[];
  onImport: (newQuestions: QuestionState[]) => void;
  onSwitchToCsv?: () => void;
}

export function QuestionBankDrawer({
  isOpen,
  onClose,
  targetSectionTitle,
  targetSectionId,
  targetDepartment = null,
  targetDepartmentName = null,
  targetLimit = 25,
  currentCount = 0,
  questionBank,
  departments = [],
  existingQuestions,
  onImport,
  onSwitchToCsv,
}: QuestionBankDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedDifficultyFilter, setSelectedDifficultyFilter] = useState<string>("ALL");
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>("ALL");
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
      setSelectedTypeFilter("ALL");
      setSelectedDifficultyFilter("ALL");
      setSelectedTopicFilter("ALL");
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
    (departments || []).forEach((d) => {
      if (d.code) {
        map.set(d.code.trim().toUpperCase(), d.name);
      }
    });
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

  // Extract unique topics for the active department scope
  const availableTopics = useMemo(() => {
    const topicsSet = new Set<string>();
    questionBank.forEach((q) => {
      if (targetDepartment) {
        const cleanTarget = targetDepartment.trim().toUpperCase();
        const qCode = q.department?.code?.trim().toUpperCase();
        if (qCode !== cleanTarget) return;
      } else if (selectedDeptFilter === "GENERAL") {
        if (q.department_id || q.department) return;
      }
      if (q.topic && q.topic.trim()) {
        topicsSet.add(q.topic.trim());
      }
    });
    return Array.from(topicsSet).sort();
  }, [questionBank, targetDepartment, selectedDeptFilter]);

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

      // Dept filter: If targetDepartment is set, strictly lock to that track.
      let matchesDept = true;
      if (targetDepartment) {
        const cleanTarget = targetDepartment.trim().toUpperCase();
        const qCode = q.department?.code?.trim().toUpperCase();
        matchesDept = qCode === cleanTarget;
      } else if (selectedDeptFilter === "GENERAL") {
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

      // Difficulty filter
      let matchesDifficulty = true;
      if (selectedDifficultyFilter !== "ALL") {
        matchesDifficulty =
          q.difficulty?.toUpperCase() === selectedDifficultyFilter.toUpperCase();
      }

      // Topic filter
      let matchesTopic = true;
      if (selectedTopicFilter !== "ALL") {
        matchesTopic = q.topic === selectedTopicFilter;
      }

      return matchesSearch && matchesDept && matchesType && matchesDifficulty && matchesTopic;
    });
  }, [
    questionBank,
    searchTerm,
    selectedDeptFilter,
    selectedTypeFilter,
    selectedDifficultyFilter,
    selectedTopicFilter,
    targetDepartment,
  ]);

  // Selection handlers
  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= availableSlots) {
          alert(
            `Target quota reached: You can select up to ${availableSlots} question(s) to fulfill the ${targetLimit}-question limit for this track.`
          );
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

    // Security check: Enforce strict department isolation
    if (targetDepartment) {
      const cleanTarget = targetDepartment.trim().toUpperCase();
      const mismatched = itemsToImport.filter(
        (q) => q.department?.code?.trim()?.toUpperCase() !== cleanTarget
      );
      if (mismatched.length > 0) {
        alert(
          `Academic Integrity Violation: Cannot import ${mismatched.length} question(s) from other departments into the ${cleanTarget} track. Syllabus isolation is strictly enforced.`
        );
        return;
      }
    }

    const convertedQuestions: QuestionState[] = itemsToImport.map((q, idx) => ({
      id: `q-imported-${Date.now()}-${idx}`,
      sectionId: targetSectionId,
      targetDepartment: targetDepartment ? targetDepartment.trim().toUpperCase() : null,
      questionType: q.question_type,
      prompt: q.prompt,
      codeSnippet: q.code_snippet || undefined,
      points: 1.0, // Standardized 1 mark
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

  const currentSelectionProgress = Math.min(
    100,
    availableSlots > 0 ? Math.round((selectedIds.size / availableSlots) * 100) : 0
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity duration-300 animate-in fade-in">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        
        {/* 1. Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 shadow-2xs">
              <BookOpen className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
                  Question Bank Importer
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-semibold truncate max-w-xs">
                  {targetSectionTitle}
                </span>
                {targetDepartment && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                    {targetDepartment} Track
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Import from Master Question Repository
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close question bank drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Executive Track Integrity & Isolation Banner */}
        {targetDepartment ? (
          <div className="px-6 py-3.5 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 flex-shrink-0 mt-0.5 sm:mt-0">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-black text-purple-950">
                    {targetDepartment} — {targetDepartmentName || "Specialization Track"}
                  </span>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-purple-200/90 text-purple-900 rounded-full tracking-wider">
                    Academic Isolation Enforced
                  </span>
                </div>
                <p className="text-[11px] text-purple-900/80 font-medium leading-relaxed mt-0.5">
                  Scoped exclusively to verified {targetDepartment} syllabus questions. Cross-department question contamination is restricted.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600">Track Quota:</span>
              <span className="text-xs font-black text-purple-950 font-mono">
                {currentCount} / {targetLimit} Qs
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-black text-emerald-700">
                {availableSlots} slots left
              </span>
            </div>
          </div>
        ) : (
          <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50 via-sky-50/40 to-white border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200 flex-shrink-0 mt-0.5 sm:mt-0">
                <Globe className="w-4 h-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-black text-blue-950">
                    Universal Common Core Curriculum
                  </span>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-blue-200/90 text-blue-900 rounded-full tracking-wider">
                    General Aptitude
                  </span>
                </div>
                <p className="text-[11px] text-blue-900/80 font-medium leading-relaxed mt-0.5">
                  Delivered universally across all institutional branches. Verified research methodology and aptitude questions.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600">Core Quota:</span>
              <span className="text-xs font-black text-blue-950 font-mono">
                {currentCount} / {targetLimit} Qs
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-black text-emerald-700">
                {availableSlots} slots left
              </span>
            </div>
          </div>
        )}

        {/* 3. Search & Filter Suite */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/60 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="relative sm:col-span-5">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search questions by prompt, topic, keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-all font-medium shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Topic Filter Dropdown */}
            <div className="sm:col-span-3">
              <select
                value={selectedTopicFilter}
                onChange={(e) => setSelectedTopicFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700 shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Topics &amp; Modules</option>
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedDifficultyFilter}
                onChange={(e) => setSelectedDifficultyFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700 shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Levels</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {/* Question Type Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700 shadow-2xs cursor-pointer"
              >
                <option value="ALL">All MCQ Types</option>
                <option value="MCQ_SINGLE">Single Choice</option>
                <option value="MCQ_MULTIPLE">Multi Select</option>
              </select>
            </div>
          </div>

          {/* Quota & Quick Action Summary Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-0.5 gap-2.5">
            <div className="flex items-center space-x-3 flex-wrap">
              <span className="text-slate-600 font-semibold text-[11px]">
                Showing <strong className="text-slate-900">{filteredQuestions.length}</strong> repository items
              </span>
              <span className="text-slate-300">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-600">Selection:</span>
                <span className="text-xs font-black text-blue-700 font-mono">
                  {selectedIds.size} / {availableSlots}
                </span>
                <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden ml-1">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${currentSelectionProgress}%` }}
                  />
                </div>
              </div>
              {selectedIds.size > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px]">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            {/* Bulk Selection Controls */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={availableSlots <= 0 || filteredQuestions.length === 0}
                className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Select Available ({availableSlots})
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                disabled={selectedIds.size === 0}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>

        {/* 4. Question Cards List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5 bg-slate-50/70">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-xs space-y-4 max-w-lg mx-auto my-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
                <BookOpen className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  {targetDepartment
                    ? `No Questions Found in ${targetDepartment} Question Bank`
                    : "No Questions Found"}
                </h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {targetDepartment
                    ? `No questions currently match the selected criteria in the ${targetDepartment} repository. Syllabus isolation prevents importing questions from other departments.`
                    : "No questions match your active search terms and filters in the master question repository."}
                </p>
              </div>

              {targetDepartment && (
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-2">
                  {onSwitchToCsv && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSwitchToCsv();
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-2xs transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload {targetDepartment} CSV</span>
                    </button>
                  )}
                  <a
                    href={`/admin/questions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Manage Question Bank</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isSelected = selectedIds.has(q.id);
              const isAlreadyInExam = existingSourceIds.has(q.id);
              const isQuotaFull = !isSelected && selectedIds.size >= availableSlots;

              // Difficulty pill styling
              const diff = (q.difficulty || "MEDIUM").toUpperCase();
              let diffBg = "bg-amber-50 text-amber-800 border-amber-200";
              if (diff === "EASY") diffBg = "bg-emerald-50 text-emerald-800 border-emerald-200";
              if (diff === "HARD") diffBg = "bg-rose-50 text-rose-800 border-rose-200";

              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelection(q.id)}
                  className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all cursor-pointer relative shadow-xs hover:shadow-md ${
                    isSelected
                      ? "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/20"
                      : isQuotaFull
                      ? "border-slate-200 opacity-60 hover:opacity-85"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Top Metadata Row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center space-x-3">
                      {/* Checkbox indicator */}
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                          isSelected
                            ? "bg-blue-700 border-blue-700 text-white shadow-2xs"
                            : "border-slate-300 bg-white hover:border-blue-500"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      {/* Badges Matrix */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-black text-slate-600 font-mono">
                          #{idx + 1}
                        </span>

                        {q.department ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-800 border border-purple-200">
                            {q.department.code}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                            General Core
                          </span>
                        )}

                        {q.topic && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center space-x-1">
                            <Tag className="w-2.5 h-2.5 text-slate-400 mr-1" />
                            <span className="truncate max-w-[180px]">{q.topic}</span>
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${diffBg}`}
                        >
                          {diff}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {q.question_type === "MCQ_SINGLE" ? "Single Choice" : "Multi Select"}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                          1.0 Mark
                        </span>

                        {isAlreadyInExam && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 flex items-center">
                            Already Added
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div className="pl-8">
                    <p className="text-xs sm:text-[13px] font-bold text-slate-900 leading-relaxed">
                      {q.prompt}
                    </p>

                    {/* Monospace Code Snippet */}
                    {q.code_snippet && (
                      <div className="mt-2.5 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                        <pre className="leading-relaxed">{q.code_snippet}</pre>
                      </div>
                    )}

                    {/* Options Grid (Generous 2-Column Responsive Layout) */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((opt, optIndex) => (
                        <div
                          key={opt.id}
                          className={`text-xs px-3 py-2 rounded-xl flex items-center space-x-2.5 border transition-all ${
                            opt.is_correct
                              ? "bg-emerald-50/90 text-emerald-950 border-emerald-300 font-bold shadow-2xs"
                              : "bg-slate-50/70 text-slate-700 border-slate-200/90 font-medium"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 border ${
                              opt.is_correct
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-slate-700 border-slate-300"
                            }`}
                          >
                            {String.fromCharCode(65 + optIndex)}
                          </span>

                          <span className="truncate flex-1">{opt.option_text}</span>

                          {opt.is_correct && (
                            <span className="inline-flex items-center text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md flex-shrink-0 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-700" />
                              Correct Key
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 5. Sticky Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="text-xs text-slate-600 font-medium">
            Ready to import <strong className="text-blue-700 font-black text-sm">{selectedIds.size}</strong>{" "}
            of <strong className="text-slate-900 font-black">{availableSlots}</strong> available slots into{" "}
            <span className="font-bold text-slate-900">{targetSectionTitle}</span>
            {targetDepartment && (
              <span className="ml-1 font-black text-purple-700">({targetDepartment} Track)</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedIds.size === 0 || selectedIds.size > availableSlots}
              className="inline-flex items-center px-5 py-2 text-xs font-black text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Import {selectedIds.size} Questions</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
