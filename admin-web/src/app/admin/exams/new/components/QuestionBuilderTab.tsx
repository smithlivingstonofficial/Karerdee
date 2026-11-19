"use client";

import React, { useState, useMemo } from "react";
import { QuestionState, SectionState, QuestionBankItem } from "../types";
import { Department } from "@/types/database.types";
import { QuestionBankDrawer } from "./QuestionBankDrawer";
import { CsvUploadDrawer } from "./CsvUploadDrawer";
import { MathText } from "@/components/MathText";
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
  ShieldCheck,
  Upload,
  ArrowRight,
  AlertCircle,
  PlusCircle,
  Check,
  Lock,
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

  // Common Core Language Variant State ("EN" | "TA")
  const [commonLang, setCommonLang] = useState<"EN" | "TA">("EN");

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

  const effectiveDeptName = useMemo(() => {
    if (!effectiveDeptTrack) return null;
    return departments.find((d) => d.code === effectiveDeptTrack)?.name || null;
  }, [departments, effectiveDeptTrack]);

  const [isBankDrawerOpen, setIsBankDrawerOpen] = useState(false);
  const [isCsvDrawerOpen, setIsCsvDrawerOpen] = useState(false);

  // Part A language partitioned questions
  const partAEnglishQuestions = useMemo(() => {
    return questions.filter(
      (q) =>
        q.sectionId === activeSection?.id &&
        q.commonLanguage !== "TA" &&
        !/[\u0B80-\u0BFF]/.test(q.prompt)
    );
  }, [questions, activeSection?.id]);

  const partATamilQuestions = useMemo(() => {
    return questions.filter(
      (q) =>
        q.sectionId === activeSection?.id &&
        (q.commonLanguage === "TA" || /[\u0B80-\u0BFF]/.test(q.prompt))
    );
  }, [questions, activeSection?.id]);

  // 3. Filter questions for current view
  const sectionQuestions = useMemo(() => {
    if (!activeSection) return [];
    if (isPartCommon) {
      return commonLang === "TA" ? partATamilQuestions : partAEnglishQuestions;
    }
    return questions.filter(
      (q) => q.sectionId === activeSection.id && q.targetDepartment === effectiveDeptTrack
    );
  }, [
    questions,
    activeSection,
    isPartCommon,
    commonLang,
    partATamilQuestions,
    partAEnglishQuestions,
    effectiveDeptTrack,
  ]);

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
    ? commonLang === "TA"
      ? partATamilQuestions.length
      : partAEnglishQuestions.length
    : questions.filter(
        (q) => q.sectionId === activeSection?.id && q.targetDepartment === effectiveDeptTrack
      ).length;
  const remainingSlots = Math.max(0, targetQuota - currentQuotaCount);
  const isQuotaComplete = currentQuotaCount === targetQuota;
  const isQuotaExceeded = currentQuotaCount > targetQuota;

  // Track completion statistics across all Part B departments
  const completedTracksCount = useMemo(() => {
    if (isPartCommon || sectionDepts.length === 0) return 0;
    return sectionDepts.filter((deptCode) => getDeptQuestionsCount(deptCode) >= targetQuota).length;
  }, [isPartCommon, sectionDepts, questions, targetQuota]);

  const totalTracksCount = sectionDepts.length;
  const allTracksCompleted = totalTracksCount > 0 && completedTracksCount === totalTracksCount;
  const tracksProgressPercent = totalTracksCount > 0
    ? Math.round((completedTracksCount / totalTracksCount) * 100)
    : 0;

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
      commonLanguage: isPartCommon ? commonLang : undefined,
      questionType: type,
      prompt: "",
      points: 1.0, // Standardized 1 mark
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
      commonLanguage: q.commonLanguage || (isPartCommon ? commonLang : undefined),
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
      if (!isPartCommon) {
        if (q.targetDepartment !== effectiveDeptTrack) return true;
      } else {
        const isCurrentLang =
          commonLang === "TA"
            ? q.commonLanguage === "TA" || /[\u0B80-\u0BFF]/.test(q.prompt)
            : q.commonLanguage !== "TA" && !/[\u0B80-\u0BFF]/.test(q.prompt);
        if (!isCurrentLang) return true;
      }

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

    const contextualized = imported.slice(0, slotsLeft).map((q) => ({
      ...q,
      targetDepartment: !isPartCommon ? effectiveDeptTrack : null,
      commonLanguage: isPartCommon ? (q.commonLanguage || commonLang) : undefined,
    }));
    onQuestionsChange([...questions, ...contextualized]);
  }

  function handleImportFromCsv(imported: QuestionState[]) {
    const slotsLeft = Math.max(0, targetQuota - currentQuotaCount);
    if (slotsLeft <= 0) return;

    const contextualized = imported.slice(0, slotsLeft).map((q) => ({
      ...q,
      targetDepartment: !isPartCommon ? effectiveDeptTrack : null,
      commonLanguage: isPartCommon ? (q.commonLanguage || commonLang) : undefined,
    }));
    onQuestionsChange([...questions, ...contextualized]);
  }

  const optionLetters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="space-y-4">
      {/* 1. Top Section Selector & Action Ribbon */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Tier 1: Main Section Tabs & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
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
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-2.5 ${
                    isSelected
                      ? isCommon
                        ? "bg-white text-blue-900 border border-blue-200 shadow-2xs ring-1 ring-blue-500/10"
                        : "bg-white text-purple-900 border border-purple-200 shadow-2xs ring-1 ring-purple-500/10"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${
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
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                      isSelected
                        ? isCommon
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-slate-200/60 text-slate-600 border-transparent"
                    }`}
                  >
                    {isCommon ? `${partAEnglishQuestions.length} EN • ${partATamilQuestions.length} TA` : `${sec.targetDepartments?.length || 0} Tracks`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons: Import + Create (Clean single plus icons) */}
          <div className="flex items-center space-x-2 self-start sm:self-center flex-shrink-0 flex-wrap gap-y-1.5">
            <button
              type="button"
              onClick={() => setIsBankDrawerOpen(true)}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : `Import from bank (${remainingSlots} slots remaining)`}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              <span>Import Bank ({remainingSlots} left)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCsvDrawerOpen(true)}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : `Upload spreadsheet / CSV (${remainingSlots} slots remaining)`}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              <span>Upload CSV</span>
            </button>
            <button
              type="button"
              onClick={() => addQuestion("MCQ_SINGLE")}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : "Add single choice MCQ"}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Single Choice
            </button>
            <button
              type="button"
              onClick={() => addQuestion("MCQ_MULTIPLE")}
              disabled={remainingSlots <= 0}
              title={remainingSlots <= 0 ? "Target question limit reached for this part" : "Add multi select MCQ"}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Multi Select
            </button>
          </div>
        </div>

        {/* Tier 2: Streamlined Track Selector & Integrated Quota Status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-0.5">
          {/* Left: Department Tracks (Part B) or Scope (Part A) */}
          <div className="flex-1 min-w-0 space-y-2">
            {isPartCommon ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/90 space-x-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setCommonLang("EN")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                      commonLang === "EN"
                        ? "bg-white text-blue-900 border border-blue-200 shadow-2xs ring-1 ring-blue-500/10"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>English Core (Universal)</span>
                    <span
                      className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                        partAEnglishQuestions.length >= targetQuota
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {partAEnglishQuestions.length}/{targetQuota} {partAEnglishQuestions.length >= targetQuota ? "✓" : ""}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCommonLang("TA")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                      commonLang === "TA"
                        ? "bg-white text-purple-900 border border-purple-200 shadow-2xs ring-1 ring-purple-500/10"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <span className="font-serif font-black text-purple-700">த</span>
                    <span>தமிழ் Core (Tamil Dept)</span>
                    <span
                      className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                        partATamilQuestions.length >= targetQuota
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-purple-100 text-purple-800 border border-purple-200"
                      }`}
                    >
                      {partATamilQuestions.length}/{targetQuota} {partATamilQuestions.length >= targetQuota ? "✓" : ""}
                    </span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  {commonLang === "EN"
                    ? "Delivered universally to CSE, MCA, ECE, MECH, MBA, etc."
                    : "Delivered strictly to Tamil Department candidates"}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Track Matrix Progress Bar */}
                <div className="flex items-center justify-between text-xs pr-2">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-purple-700" />
                    <span className="font-extrabold text-slate-900 text-xs">
                      Specialization Tracks Matrix ({sectionDepts.length} Departments)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-500">
                      {completedTracksCount} of {totalTracksCount} Complete
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        allTracksCompleted
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      {allTracksCompleted ? "All Tracks Ready ✓" : `${totalTracksCount - completedTracksCount} Pending`}
                    </span>
                  </div>
                </div>

                {/* Chips Grid */}
                {sectionDepts.length === 0 ? (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                    No departments selected in Part B. Go to Tab 02 to assign departments.
                  </span>
                ) : (
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
                    {sectionDepts.map((deptCode) => {
                      const isSelected = effectiveDeptTrack === deptCode;
                      const deptCount = getDeptQuestionsCount(deptCode);
                      const isDeptComplete = deptCount >= targetQuota;
                      const dName = departments.find((d) => d.code === deptCode)?.name;
                      return (
                        <button
                          key={deptCode}
                          type="button"
                          onClick={() => setSelectedDeptTrack(deptCode)}
                          title={dName ? `${deptCode} — ${dName}` : `${deptCode} Specialization Track`}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs ${
                            isSelected
                              ? "bg-purple-700 text-white border-purple-800 ring-2 ring-purple-500/30"
                              : isDeptComplete
                              ? "bg-emerald-50/80 text-emerald-950 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
                              : "bg-amber-50/70 text-amber-950 border-amber-300 hover:bg-amber-100"
                          }`}
                        >
                          <span>{deptCode} Track</span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                              isSelected
                                ? isDeptComplete
                                  ? "bg-emerald-500 text-white"
                                  : "bg-purple-900 text-purple-100"
                                : isDeptComplete
                                ? "bg-emerald-200/90 text-emerald-950"
                                : "bg-amber-200/90 text-amber-950"
                            }`}
                          >
                            {isDeptComplete ? `${deptCount}/${targetQuota} ✓` : `${deptCount}/${targetQuota}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Integrated Quota Progress Meter */}
          <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200/90 rounded-2xl px-4 py-2.5 self-start lg:self-center flex-shrink-0 shadow-2xs">
            <div className="text-left sm:text-right">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-600">
                  {isPartCommon
                    ? commonLang === "TA"
                      ? "Part A (தமிழ்):"
                      : "Part A (English):"
                    : `${effectiveDeptTrack || "Dept"} Track:`}
                </span>
                <span className="text-xs font-black text-slate-900 font-mono">
                  {currentQuotaCount} / {targetQuota} Qs
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium block leading-none mt-0.5">
                {isQuotaComplete
                  ? "Quota fulfilled (100%) ✓"
                  : isQuotaExceeded
                  ? `+${currentQuotaCount - targetQuota} over target`
                  : `${remainingSlots} questions remaining`}
              </span>
            </div>

            {/* Mini Progress Bar */}
            <div className="w-20 sm:w-28 bg-slate-200/80 h-2 rounded-full overflow-hidden">
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
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
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
                className="px-2.5 py-1 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-all cursor-pointer shadow-2xs"
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
        <div className="bg-gradient-to-b from-white via-slate-50/50 to-slate-50/80 border border-slate-200/90 rounded-3xl p-8 sm:p-12 text-center shadow-xs space-y-6">
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/60 border border-blue-200 text-blue-700 flex items-center justify-center shadow-xs">
            <BookOpen className="w-8 h-8 text-blue-700" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 text-white text-[9px] font-black items-center justify-center">!</span>
            </span>
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 mb-1 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              <span>
                {isPartCommon
                  ? commonLang === "TA"
                    ? "தமிழ் Common Core (Tamil Dept)"
                    : "English Common Core (Universal)"
                  : `${effectiveDeptTrack} Specialization Track`}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {isPartCommon
                ? commonLang === "TA"
                  ? "Part A (தமிழ் Core) Ready for Questions"
                  : "Part A (English Core) Ready for Questions"
                : `${effectiveDeptTrack} Track is Ready for Content`}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isPartCommon
                ? commonLang === "TA"
                  ? "This section provides the research methodology curriculum in Tamil language specifically for candidates in the Tamil Department."
                  : "This section is delivered universally to all candidates in CSE, MCA, ECE, MECH, MBA, etc."
                : `This track is allocated strictly to ${effectiveDeptName || effectiveDeptTrack} examinees. ${targetQuota} specialization questions are required to complete this track's quota.`}
            </p>
          </div>

          {/* 3 Interactive Pathway Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mx-auto text-left">
            {/* Pathway 1: Question Bank Importer (Recommended) */}
            <div
              onClick={() => setIsBankDrawerOpen(true)}
              className="group bg-white hover:bg-blue-50/40 border-2 border-blue-200 hover:border-blue-600 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800">
                    Recommended
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-900 group-hover:text-blue-900">
                  {isPartCommon ? "Import Common Bank" : `Import ${effectiveDeptTrack} Bank`}
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  {isPartCommon
                    ? "Select from verified aptitude & quantitative research methodology questions."
                    : `Instant 1-click import from 30 peer-reviewed ${effectiveDeptTrack} repository questions.`}
                </p>
              </div>
              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center text-xs font-bold text-blue-700 group-hover:text-blue-800">
                <span>Open Repository</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Pathway 2: Bulk CSV Ingestion */}
            <div
              onClick={() => setIsCsvDrawerOpen(true)}
              className="group bg-white hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-500 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600">
                    Spreadsheet
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">
                  Upload .CSV Sheet
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Ingest formatted question sheets with answer keys and distractor options.
                </p>
              </div>
              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                <span>Upload CSV</span>
                <Upload className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>

            {/* Pathway 3: Interactive Single Choice MCQ */}
            <div
              onClick={() => addQuestion("MCQ_SINGLE")}
              className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-400 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600">
                    Interactive
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-900 group-hover:text-slate-950">
                  Author Custom MCQ
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Build custom single-choice or multi-select questions with code snippets and options.
                </p>
              </div>
              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center text-xs font-bold text-slate-700 group-hover:text-slate-900">
                <span>Create Manually</span>
                <Plus className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sectionQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              {/* Question Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1.5">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-900 font-black text-xs flex items-center justify-center border border-blue-200 shadow-2xs font-mono">
                    Q{(idx + 1).toString().padStart(2, "0")}
                  </span>

                  {/* Question Type Selector */}
                  <select
                    value={q.questionType}
                    onChange={(e) =>
                      updateQuestion(q.id, {
                        questionType: e.target.value as "MCQ_SINGLE" | "MCQ_MULTIPLE",
                      })
                    }
                    className="text-xs font-bold bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer shadow-2xs"
                  >
                    <option value="MCQ_SINGLE">Single Choice (Radio)</option>
                    <option value="MCQ_MULTIPLE">Multiple Choice (Checkboxes)</option>
                  </select>

                  {/* Target Department Badge */}
                  {q.targetDepartment ? (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 flex items-center space-x-1 shadow-2xs">
                      <Building2 className="w-3 h-3 text-purple-600 mr-1" />
                      {q.targetDepartment} Track
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 flex items-center space-x-1 shadow-2xs">
                      <Globe className="w-3 h-3 text-blue-600 mr-1" />
                      General Core
                    </span>
                  )}

                  {/* Source Bank Origin */}
                  {q.sourceQuestionId && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 flex items-center space-x-1">
                      <BookOpen className="w-2.5 h-2.5 text-slate-400 mr-1" />
                      <span>From Bank</span>
                    </span>
                  )}
                </div>

                {/* Scoring Weight & Negative Penalty */}
                <div className="flex items-center space-x-3 self-end sm:self-center">
                  <div className="flex items-center space-x-1.5" title="Institutional Policy: 1 mark per question (Deterministic scoring)">
                    <span className="text-xs text-slate-500 font-semibold">Marks:</span>
                    <span className="px-2.5 py-1 text-xs font-black text-blue-800 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-1 shadow-2xs">
                      <Lock className="w-3 h-3 text-blue-600 mr-1" />
                      1.0 Mark
                    </span>
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
                        className="w-16 px-2 py-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-600 text-center shadow-2xs"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
                    <button
                      type="button"
                      onClick={() => duplicateQuestion(q)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                      title="Duplicate Question"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Question Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                  placeholder="Enter the question prompt here..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all font-medium leading-relaxed shadow-2xs"
                />

                {/* Live Equation / Math Preview */}
                {Boolean(q.prompt && (/[²³⁴⁰¹⁵⁶⁷⁸⁹πδρṁ√∮∫∞±×÷^$]/.test(q.prompt) || (q.prompt.includes("=") && /[a-zA-Z]/.test(q.prompt)))) && (
                  <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-blue-950 flex items-start space-x-2 animate-in fade-in duration-150">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex-shrink-0 mt-0.5">
                      Formula Preview:
                    </span>
                    <div className="flex-1 font-medium leading-relaxed">
                      <MathText text={q.prompt} />
                    </div>
                  </div>
                )}
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
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center space-x-1.5 cursor-pointer mb-1.5"
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
                    className="w-full font-mono text-xs px-3.5 py-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed shadow-xs"
                  />
                )}
              </div>

              {/* Options Section */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Options &amp; Correct Answer Key (Click option badge to set correct)
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

                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={opt.id}
                      className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                        opt.isCorrect
                          ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-500/20 shadow-2xs"
                          : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Correct Answer Toggle Button */}
                      <button
                        type="button"
                        onClick={() => toggleCorrectOption(q.id, opt.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs border transition-all cursor-pointer ${
                          opt.isCorrect
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                        }`}
                        title={opt.isCorrect ? "Correct Option Key" : "Click to set as correct answer key"}
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

                      {/* Live Equation Preview Badge for Option */}
                      {Boolean(opt.text && (/[²³⁴⁰¹⁵⁶⁷⁸⁹πδρṁ√∮∫∞±×÷^$]/.test(opt.text) || (opt.text.includes("=") && /[a-zA-Z]/.test(opt.text)))) && (
                        <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-md text-xs font-serif font-medium flex-shrink-0" title="Rendered equation preview">
                          <MathText text={opt.text} />
                        </span>
                      )}

                      {/* Correct Badge */}
                      {opt.isCorrect && (
                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-md flex items-center border border-emerald-300 flex-shrink-0 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                          Correct Key
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
        targetSectionTitle={
          isPartCommon
            ? `Part A - ${commonLang === "TA" ? "தமிழ் Core" : "English Core"}`
            : activeSection?.title || "Active Section"
        }
        targetSectionId={activeSection?.id || ""}
        targetDepartment={!isPartCommon ? effectiveDeptTrack : null}
        targetDepartmentName={!isPartCommon ? effectiveDeptName : null}
        targetLanguage={isPartCommon ? commonLang : undefined}
        targetLimit={targetQuota}
        currentCount={currentQuotaCount}
        questionBank={questionBank}
        departments={departments}
        existingQuestions={questions}
        onImport={handleImportFromBank}
        onSwitchToCsv={() => setIsCsvDrawerOpen(true)}
      />

      {/* 5. Bulk Spreadsheet / CSV Ingestion Drawer */}
      <CsvUploadDrawer
        isOpen={isCsvDrawerOpen}
        onClose={() => setIsCsvDrawerOpen(false)}
        targetSectionTitle={
          isPartCommon
            ? `Part A - ${commonLang === "TA" ? "தமிழ் Core" : "English Core"}`
            : activeSection?.title || "Active Section"
        }
        targetSectionId={activeSection?.id || ""}
        targetDepartment={!isPartCommon ? effectiveDeptTrack : null}
        targetLanguage={isPartCommon ? commonLang : undefined}
        targetLimit={targetQuota}
        currentCount={currentQuotaCount}
        existingQuestionsCount={questions.length}
        onImport={handleImportFromCsv}
      />
    </div>
  );
}
