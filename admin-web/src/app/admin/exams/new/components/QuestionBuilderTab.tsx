"use client";

import React, { useState } from "react";
import { QuestionState, SectionState, QuestionBankItem } from "../types";
import { Department } from "@/types/database.types";
import { QuestionBankDrawer } from "./QuestionBankDrawer";
import { CsvUploadDrawer } from "./CsvUploadDrawer";
import {
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  Code2,
  ListOrdered,
  BookOpen,
  Sparkles,
  Layers,
  Building2,
  Globe,
  Tag,
  FileSpreadsheet,
} from "lucide-react";

interface QuestionBuilderTabProps {
  sections: SectionState[];
  questions: QuestionState[];
  questionBank: QuestionBankItem[];
  departments?: Department[];
  enableNegativeMarking: boolean;
  onQuestionsChange: (questions: QuestionState[]) => void;
}

export function QuestionBuilderTab({
  sections,
  questions,
  questionBank,
  departments = [],
  enableNegativeMarking,
  onQuestionsChange,
}: QuestionBuilderTabProps) {
  // 1. Active Section State
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sections[0]?.id || ""
  );

  // 2. Department Sub-tab State for Part B (Department Electives)
  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];
  const isPartCommon = activeSection?.isCommon ?? true;

  // Active departments assigned to this section
  const sectionDepts = activeSection?.targetDepartments || [];
  const [selectedDeptTrack, setSelectedDeptTrack] = useState<string>(
    sectionDepts[0] || ""
  );

  // Ensure active department selection is valid when switching sections
  const effectiveDeptTrack = !isPartCommon
    ? sectionDepts.includes(selectedDeptTrack)
      ? selectedDeptTrack
      : sectionDepts[0] || ""
    : "";

  const [isBankDrawerOpen, setIsBankDrawerOpen] = useState(false);
  const [isCsvDrawerOpen, setIsCsvDrawerOpen] = useState(false);

  // 3. Filter questions for current view
  const sectionQuestions = questions.filter((q) => {
    if (q.sectionId !== activeSection?.id) return false;
    if (isPartCommon) return true; // Part A shows all common questions
    // Part B filters by active department sub-tab
    return q.targetDepartment === effectiveDeptTrack;
  });

  // Count helper per department in Part B
  function getDeptQuestionsCount(deptCode: string) {
    return questions.filter(
      (q) => q.sectionId === activeSection?.id && q.targetDepartment === deptCode
    ).length;
  }

  // Count helper per section
  function getSectionTotalQuestionsCount(secId: string) {
    return questions.filter((q) => q.sectionId === secId).length;
  }

  // Quota & Capacity Calculation for active section / department track
  const targetQuota = activeSection?.targetQuestionCount || 25;
  const currentQuotaCount = isPartCommon
    ? sectionQuestions.length
    : questions.filter(
        (q) => q.sectionId === activeSection?.id && q.targetDepartment === effectiveDeptTrack
      ).length;
  const remainingSlots = Math.max(0, targetQuota - currentQuotaCount);
  const isQuotaComplete = currentQuotaCount === targetQuota;
  const isQuotaExceeded = currentQuotaCount > targetQuota;

  function addQuestion(type: "MCQ_SINGLE" | "MCQ_MULTIPLE") {
    if (!activeSection) return;

    if (currentQuotaCount >= targetQuota) {
      alert(
        `Target question limit (${targetQuota}) reached for ${
          isPartCommon ? "Part A" : `${effectiveDeptTrack || "Department"} track`
        }. If you need to add more questions, please increase the total questions limit in Section 02.`
      );
      return;
    }

    const newQ: QuestionState = {
      id: `q-${Date.now()}`,
      sectionId: activeSection.id,
      targetDepartment: !isPartCommon ? effectiveDeptTrack : null,
      questionType: type,
      prompt: "",
      points: activeSection.defaultPoints ?? 1.0,
      negativePoints: activeSection.defaultNegativePoints ?? 0.25,
      orderIndex: sectionQuestions.length + 1,
      options: [
        { id: `opt-${Date.now()}-1`, text: "", isCorrect: true, orderIndex: 1 },
        { id: `opt-${Date.now()}-2`, text: "", isCorrect: false, orderIndex: 2 },
        { id: `opt-${Date.now()}-3`, text: "", isCorrect: false, orderIndex: 3 },
        { id: `opt-${Date.now()}-4`, text: "", isCorrect: false, orderIndex: 4 },
      ],
    };

    onQuestionsChange([...questions, newQ]);
  }

  function updateQuestion(qId: string, partial: Partial<QuestionState>) {
    onQuestionsChange(
      questions.map((q) => (q.id === qId ? { ...q, ...partial } : q))
    );
  }

  function removeQuestion(qId: string) {
    onQuestionsChange(questions.filter((q) => q.id !== qId));
  }

  function duplicateQuestion(q: QuestionState) {
    if (currentQuotaCount >= targetQuota) {
      alert(
        `Target question limit (${targetQuota}) reached for ${
          isPartCommon ? "Part A" : `${effectiveDeptTrack || "Department"} track`
        }. You cannot duplicate questions beyond the designated quota.`
      );
      return;
    }

    const dup: QuestionState = {
      ...q,
      id: `q-${Date.now()}`,
      prompt: `${q.prompt} (Copy)`,
      orderIndex: sectionQuestions.length + 1,
      options: q.options.map((opt, i) => ({
        ...opt,
        id: `opt-${Date.now()}-${i}`,
      })),
    };
    onQuestionsChange([...questions, dup]);
  }

  function toggleCorrectOption(qId: string, optId: string) {
    const targetQ = questions.find((q) => q.id === qId);
    if (!targetQ) return;

    let updatedOptions = [];

    if (targetQ.questionType === "MCQ_SINGLE") {
      updatedOptions = targetQ.options.map((opt) => ({
        ...opt,
        isCorrect: opt.id === optId,
      }));
    } else {
      updatedOptions = targetQ.options.map((opt) =>
        opt.id === optId ? { ...opt, isCorrect: !opt.isCorrect } : opt
      );
    }

    updateQuestion(qId, { options: updatedOptions });
  }

  function updateOptionText(qId: string, optId: string, text: string) {
    const targetQ = questions.find((q) => q.id === qId);
    if (!targetQ) return;

    const updatedOptions = targetQ.options.map((opt) =>
      opt.id === optId ? { ...opt, text } : opt
    );
    updateQuestion(qId, { options: updatedOptions });
  }

  function addOption(qId: string) {
    const targetQ = questions.find((q) => q.id === qId);
    if (!targetQ || targetQ.options.length >= 6) return;

    const newOpt = {
      id: `opt-${Date.now()}-${targetQ.options.length + 1}`,
      text: "",
      isCorrect: false,
      orderIndex: targetQ.options.length + 1,
    };
    updateQuestion(qId, { options: [...targetQ.options, newOpt] });
  }

  function removeOption(qId: string, optId: string) {
    const targetQ = questions.find((q) => q.id === qId);
    if (!targetQ || targetQ.options.length <= 2) return;

    const filtered = targetQ.options.filter((opt) => opt.id !== optId);
    if (!filtered.some((opt) => opt.isCorrect)) {
      filtered[0].isCorrect = true;
    }
    updateQuestion(qId, { options: filtered });
  }

  function trimToQuota() {
    if (!activeSection || !isQuotaExceeded) return;

    let kept = 0;
    const updated = questions.filter((q) => {
      if (q.sectionId !== activeSection.id) return true;
      if (!isPartCommon && q.targetDepartment !== effectiveDeptTrack) return true;

      if (kept < targetQuota) {
        kept++;
        return true;
      }
      return false; // drop excess beyond target quota
    });

    onQuestionsChange(updated);
  }

  function handleImportFromBank(imported: QuestionState[]) {
    const slotsLeft = Math.max(0, targetQuota - currentQuotaCount);
    if (slotsLeft <= 0) return;

    // Ensure all imported questions carry the active department context and never exceed quota
    const contextualized = imported.slice(0, slotsLeft).map((q) => ({
      ...q,
      targetDepartment: !isPartCommon ? effectiveDeptTrack : null,
    }));
    onQuestionsChange([...questions, ...contextualized]);
  }

  function handleImportFromCsv(imported: QuestionState[]) {
    const slotsLeft = Math.max(0, targetQuota - currentQuotaCount);
    if (slotsLeft <= 0) return;

    // Ensure all imported questions carry the active department context and never exceed quota
    const contextualized = imported.slice(0, slotsLeft).map((q) => ({
      ...q,
      targetDepartment: !isPartCommon ? effectiveDeptTrack : null,
    }));
    onQuestionsChange([...questions, ...contextualized]);
  }

  const optionLetters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="space-y-3">
      {/* 1. Top Section Selector & Action Ribbon */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Tier 1: Main Section Tabs & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Segmented Section Switcher */}
          <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 space-x-1 overflow-x-auto">
            {sections.map((sec, idx) => {
              const isSelected = sec.id === (activeSection?.id || "");
              const isCommon = sec.isCommon;
              const target = sec.targetQuestionCount ?? 25;
              const count = isCommon
                ? getSectionTotalQuestionsCount(sec.id)
                : questions.filter((q) => q.sectionId === sec.id).length;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                    isSelected
                      ? isCommon
                        ? "bg-white text-blue-900 border border-blue-200 shadow-2xs ring-1 ring-blue-500/10"
                        : "bg-white text-purple-900 border border-purple-200 shadow-2xs ring-1 ring-purple-500/10"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded text-[10px] font-black flex items-center justify-center ${
                      isSelected
                        ? isCommon
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                        : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-bold">
                    {isCommon ? "Part A (Common Core)" : "Part B (Department Tracks)"}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold border ${
                      isSelected
                        ? isCommon
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-slate-200/60 text-slate-600 border-transparent"
                    }`}
                  >
                    {isCommon ? `${count} / ${target}` : `${sec.targetDepartments?.length || 0} Tracks`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons: Import + Create (Clean single plus icons) */}
          <div className="flex items-center space-x-2 self-start sm:self-center flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsBankDrawerOpen(true)}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : `Import from bank (${remainingSlots} slots remaining)`}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              <span>Import Bank ({remainingSlots} left)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCsvDrawerOpen(true)}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : `Upload spreadsheet / CSV (${remainingSlots} slots remaining)`}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              <span>Upload CSV</span>
            </button>
            <button
              type="button"
              onClick={() => addQuestion("MCQ_SINGLE")}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : "Add single choice MCQ"}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Single Choice
            </button>
            <button
              type="button"
              onClick={() => addQuestion("MCQ_MULTIPLE")}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : "Add multi select MCQ"}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Multi Select
            </button>
          </div>
        </div>

        {/* Tier 2: Streamlined Track Selector & Integrated Quota Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-0.5">
          {/* Left: Department Tracks (Part B) or Scope (Part A) */}
          <div className="flex items-center space-x-2 flex-wrap">
            {isPartCommon ? (
              <div className="flex items-center space-x-2 text-xs text-slate-600">
                <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/80">
                  <Globe className="w-3 h-3" />
                </div>
                <span className="font-semibold text-slate-800">General Core Syllabus</span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] text-slate-500">Delivered to all registered candidates</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center mr-1">
                  <Building2 className="w-3.5 h-3.5 mr-1 text-purple-600" />
                  Tracks:
                </span>

                {sectionDepts.length === 0 ? (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                    No departments selected in Part B. Go to Tab 02 to assign departments.
                  </span>
                ) : (
                  sectionDepts.map((deptCode) => {
                    const isSelected = effectiveDeptTrack === deptCode;
                    const deptCount = getDeptQuestionsCount(deptCode);
                    const isDeptComplete = deptCount >= targetQuota;
                    return (
                      <button
                        key={deptCode}
                        type="button"
                        onClick={() => setSelectedDeptTrack(deptCode)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                          isSelected
                            ? "bg-purple-100 text-purple-950 border-purple-300 shadow-2xs ring-1 ring-purple-400/20"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <span>{deptCode} Track</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                            isSelected
                              ? isDeptComplete
                                ? "bg-emerald-600 text-white"
                                : "bg-purple-700 text-white"
                              : isDeptComplete
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {deptCount} / {targetQuota}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Right: Integrated Quota Progress Meter */}
          <div className="flex items-center space-x-3 bg-slate-50/90 border border-slate-200/80 rounded-xl px-3 py-1.5 self-start md:self-auto">
            <div className="text-left md:text-right">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-700">
                  {isPartCommon ? "Part A Quota:" : `${effectiveDeptTrack || "Dept"} Track:`}
                </span>
                <span className="text-xs font-black text-slate-900">
                  {currentQuotaCount} / {targetQuota} Qs
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block leading-none">
                {isQuotaComplete
                  ? "Target quota fulfilled ✓"
                  : isQuotaExceeded
                  ? `+${currentQuotaCount - targetQuota} over target`
                  : `${remainingSlots} questions remaining`}
              </span>
            </div>

            {/* Mini Progress Bar */}
            <div className="w-20 sm:w-28 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isQuotaComplete
                    ? "bg-emerald-600"
                    : isQuotaExceeded
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{
                  width: `${Math.min(100, Math.round((currentQuotaCount / targetQuota) * 100))}%`,
                }}
              />
            </div>

            {/* Status Badge */}
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                isQuotaComplete
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : isQuotaExceeded
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-white text-blue-700 border-blue-200 shadow-2xs"
              }`}
            >
              {isQuotaComplete
                ? "Complete ✓"
                : isQuotaExceeded
                ? `+${currentQuotaCount - targetQuota} Over`
                : `${remainingSlots} Left`}
            </span>

            {/* Quick Trim to Quota Button when Over Limit */}
            {isQuotaExceeded && (
              <button
                type="button"
                onClick={trimToQuota}
                className="px-2 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md transition-all cursor-pointer shadow-2xs"
                title={`Trim excess questions to fit target limit (${targetQuota})`}
              >
                Trim to {targetQuota} Qs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Questions List */}
      {sectionQuestions.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isPartCommon
                ? "No Questions in Part A (Common Core)"
                : `No Questions in ${effectiveDeptTrack || "this Department"} Track`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {isPartCommon
                ? "Add general research questions interactively or import them from the Master Question Bank."
                : `Add specialization questions strictly for ${effectiveDeptTrack} candidates, or import from the ${effectiveDeptTrack} Question Bank.`}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsBankDrawerOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              {isPartCommon
                ? "Import General Core Questions"
                : `Import ${effectiveDeptTrack} Questions`}
            </button>
            <button
              type="button"
              onClick={() => setIsCsvDrawerOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Upload Spreadsheet (.csv)
            </button>
            <button
              type="button"
              onClick={() => addQuestion("MCQ_SINGLE")}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Single Choice MCQ
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sectionQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              {/* Question Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 font-extrabold text-[11px] flex items-center justify-center border border-blue-200/80">
                    Q{idx + 1}
                  </span>

                  {/* Question Type Selector */}
                  <select
                    value={q.questionType}
                    onChange={(e) =>
                      updateQuestion(q.id, {
                        questionType: e.target.value as "MCQ_SINGLE" | "MCQ_MULTIPLE",
                      })
                    }
                    className="text-xs font-bold bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="MCQ_SINGLE">Single Choice (Radio)</option>
                    <option value="MCQ_MULTIPLE">Multiple Choice (Checkboxes)</option>
                  </select>

                  {/* Target Department Badge */}
                  {q.targetDepartment ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Dept: {q.targetDepartment}
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Common Core
                    </span>
                  )}

                  {/* Source Bank Origin */}
                  {q.sourceQuestionId && (
                    <span className="text-[10px] font-medium text-slate-400">
                      • from bank
                    </span>
                  )}
                </div>

                {/* Score & Negative Penalty Inputs */}
                <div className="flex items-center space-x-3 self-end sm:self-center">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs text-slate-500 font-semibold">Marks:</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={q.points}
                      onChange={(e) =>
                        updateQuestion(q.id, {
                          points: parseFloat(e.target.value) || 1.0,
                        })
                      }
                      className="w-14 px-1.5 py-1 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 text-center"
                    />
                  </div>

                  {enableNegativeMarking && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-amber-700 font-semibold">Penalty:</span>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        value={q.negativePoints}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            negativePoints: parseFloat(e.target.value) || 0.0,
                          })
                        }
                        className="w-14 px-1.5 py-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-600 text-center"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-0.5 pl-2 border-l border-slate-200">
                    <button
                      type="button"
                      onClick={() => duplicateQuestion(q)}
                      className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Duplicate Question"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Question Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                  placeholder="Enter the question prompt here..."
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all font-medium leading-relaxed"
                />
              </div>

              {/* Monospaced Code Snippet Box */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    updateQuestion(q.id, {
                      codeSnippet: q.codeSnippet !== undefined ? undefined : "",
                    })
                  }
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center space-x-1 cursor-pointer mb-1.5"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>
                    {q.codeSnippet !== undefined
                      ? "Remove Code Snippet"
                      : "+ Add Code Snippet (Monospace)"}
                  </span>
                </button>

                {q.codeSnippet !== undefined && (
                  <textarea
                    rows={3}
                    value={q.codeSnippet}
                    onChange={(e) => updateQuestion(q.id, { codeSnippet: e.target.value })}
                    placeholder="// Optional code snippet rendered in monospace for candidates..."
                    className="w-full font-mono text-xs px-3 py-2 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                )}
              </div>

              {/* Options Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Options &amp; Correct Key (Click option badge to set correct)
                  </span>
                  {q.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => addOption(q.id)}
                      className="text-xs font-bold text-blue-700 hover:text-blue-800 cursor-pointer"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={opt.id}
                      className={`flex items-center space-x-2.5 p-2 rounded-xl border transition-all ${
                        opt.isCorrect
                          ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-500/20"
                          : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Correct Answer Toggle Button */}
                      <button
                        type="button"
                        onClick={() => toggleCorrectOption(q.id, opt.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs border transition-all cursor-pointer ${
                          opt.isCorrect
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                        }`}
                        title={opt.isCorrect ? "Correct Option" : "Click to set as correct"}
                      >
                        {optionLetters[optIdx] || optIdx + 1}
                      </button>

                      {/* Option Text Input */}
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOptionText(q.id, opt.id, e.target.value)}
                        placeholder={`Option ${optionLetters[optIdx] || optIdx + 1} text...`}
                        className="flex-1 px-2.5 py-1 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-slate-900 placeholder:text-slate-400 font-medium"
                      />

                      {/* Correct Badge */}
                      {opt.isCorrect && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full flex items-center border border-emerald-300 flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Correct
                        </span>
                      )}

                      {/* Delete Option */}
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(q.id, opt.id)}
                          className="p-1 text-slate-300 hover:text-red-600 transition-colors cursor-pointer"
                          title="Remove Option"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Smart Context-Aware Question Bank Importer Drawer */}
      <QuestionBankDrawer
        isOpen={isBankDrawerOpen}
        onClose={() => setIsBankDrawerOpen(false)}
        targetSectionTitle={activeSection?.title || "Active Section"}
        targetSectionId={activeSection?.id || ""}
        targetDepartment={!isPartCommon ? effectiveDeptTrack : null}
        targetLimit={targetQuota}
        currentCount={currentQuotaCount}
        questionBank={questionBank}
        departments={departments}
        existingQuestions={questions}
        onImport={handleImportFromBank}
      />

      {/* 5. Bulk Spreadsheet / CSV Ingestion Drawer */}
      <CsvUploadDrawer
        isOpen={isCsvDrawerOpen}
        onClose={() => setIsCsvDrawerOpen(false)}
        targetSectionTitle={activeSection?.title || "Active Section"}
        targetSectionId={activeSection?.id || ""}
        targetDepartment={!isPartCommon ? effectiveDeptTrack : null}
        targetLimit={targetQuota}
        currentCount={currentQuotaCount}
        existingQuestionsCount={questions.length}
        onImport={handleImportFromCsv}
      />
    </div>
  );
}
