"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExamGeneralState,
  SectionState,
  QuestionState,
  QuestionBankItem,
} from "./types";
import { Department } from "@/types/database.types";
import { GeneralSetupTab } from "./components/GeneralSetupTab";
import { SectionsTab } from "./components/SectionsTab";
import { QuestionBuilderTab } from "./components/QuestionBuilderTab";
import { SecurityLockdownTab } from "./components/SecurityLockdownTab";
import { CandidateToolsTab } from "./components/CandidateToolsTab";
import {
  getExamAuthoringContextAction,
  saveExamAction,
  getExamForEditingAction,
} from "./actions";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Bookmark,
  Settings2,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Calculator,
  Loader2,
} from "lucide-react";

type TabId = "GENERAL" | "SECTIONS" | "QUESTIONS" | "TOOLS" | "SECURITY";

interface TabMeta {
  id: TabId;
  step: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge?: string | number;
}

export default function ExamAuthoringStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-16 text-slate-500 text-xs font-semibold">
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-blue-700" />
          Loading Exam Studio...
        </div>
      }
    >
      <ExamAuthoringStudioContent />
    </Suspense>
  );
}

function ExamAuthoringStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id") || searchParams.get("draftId");

  // 1. Studio State
  const [activeTab, setActiveTab] = useState<TabId>("GENERAL");
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [examId, setExamId] = useState<string | null>(editId || null);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Authoring context from Supabase (live departments and question bank)
  const [departments, setDepartments] = useState<Department[]>([]);
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>([]);

  // 2. Examination Configuration State (100% Customizable)
  const [general, setGeneral] = useState<ExamGeneralState>({
    title: "",
    courseCode: "",
    description: "",
    instructions:
      "1. Ensure all background applications are terminated before starting.\n2. The examination environment is protected by Win32 low-level hardware hooks.\n3. Switching windows or pressing restricted shortcuts will register an infraction strike.\n4. You must keep your webcam unobstructed throughout the sitting.",
    passcode: "PHD2026",
    durationMinutes: 90,
    startTime: "",
    endTime: "",
    lateEntryBufferMinutes: 15,
    earlySubmissionMinPercent: 50,
    maxStrikes: 3,
    strikeAction: "LOCK_WORKSTATION",
    randomizeQuestions: true,
    randomizeOptions: true,
    enableNegativeMarking: false,
    calculatorMode: "NONE",
    enableScratchpad: true,
    enableQuestionFlagging: true,
    lockdownPolicy: {
      blockKeyboardHooks: true,
      blockDisplayAffinity: true,
      blockMultipleMonitors: true,
      blockVirtualMachines: true,
      blockBlacklistedProcesses: true,
      lockHardwareFingerprint: false,
    },
  });

  const [sections, setSections] = useState<SectionState[]>([
    {
      id: "sec-default-part-a",
      title: "Part A — Common Research & Quantitative Aptitude",
      isCommon: true,
      targetDepartments: [],
      defaultPoints: 1.0,
      defaultNegativePoints: 0.25,
      orderIndex: 1,
      navigationMode: "FLEXIBLE",
      timeLimitMinutes: null,
      targetQuestionCount: 20,
    },
    {
      id: "sec-default-part-b",
      title: "Part B — Department Core Specialization",
      isCommon: false,
      targetDepartments: [],
      defaultPoints: 1.0,
      defaultNegativePoints: 0.25,
      orderIndex: 2,
      navigationMode: "FLEXIBLE",
      timeLimitMinutes: null,
      targetQuestionCount: 30,
    },
  ]);

  const [questions, setQuestions] = useState<QuestionState[]>([]);

  // 3. Load Live Context from Supabase & Optional Draft to Edit
  useEffect(() => {
    async function loadContext() {
      setIsLoadingContext(true);
      try {
        const [res, draftRes] = await Promise.all([
          getExamAuthoringContextAction(),
          editId ? getExamForEditingAction(editId) : Promise.resolve(null),
        ]);

        if (res.departments) {
          setDepartments(res.departments);
        }
        if (res.questionBank) {
          setQuestionBank(res.questionBank);
        }

        if (draftRes && draftRes.exam) {
          setGeneral(draftRes.exam);
          if (draftRes.sections && draftRes.sections.length > 0) {
            setSections(draftRes.sections);
          }
          if (draftRes.questions) {
            setQuestions(draftRes.questions);
          }
          setExamId(editId);
          setIsDraftMode(draftRes.status === "DRAFT");
        }
      } catch (err: any) {
        console.error("Failed to load authoring context:", err);
      } finally {
        setIsLoadingContext(false);
      }
    }
    loadContext();
  }, [editId]);

  // 4. Computed Metrics for Tab Badges
  const totalQuestions = questions.length;
  const activeLockdownGuardsCount = Object.values(
    general.lockdownPolicy || {}
  ).filter(Boolean).length;

  // Tabs metadata definition
  const tabsList: TabMeta[] = [
    {
      id: "GENERAL",
      step: "01",
      label: "General Parameters",
      shortLabel: "General",
      icon: Settings2,
    },
    {
      id: "SECTIONS",
      step: "02",
      label: "Sections & Routing",
      shortLabel: "Sections",
      icon: Layers,
      badge: sections.length,
    },
    {
      id: "QUESTIONS",
      step: "03",
      label: "Question Builder",
      shortLabel: "Questions",
      icon: HelpCircle,
      badge: totalQuestions,
    },
    {
      id: "TOOLS",
      step: "04",
      label: "Candidate Tools & Rules",
      shortLabel: "Tools",
      icon: Calculator,
    },
    {
      id: "SECURITY",
      step: "05",
      label: "Security & Lockdown",
      shortLabel: "Security",
      icon: ShieldCheck,
      badge: `${activeLockdownGuardsCount}/6`,
    },
  ];

  const currentTabIndex = tabsList.findIndex((t) => t.id === activeTab);
  const prevTab = currentTabIndex > 0 ? tabsList[currentTabIndex - 1] : null;
  const nextTab = currentTabIndex < tabsList.length - 1 ? tabsList[currentTabIndex + 1] : null;

  // 5. Save Examination (Draft or Published)
  async function handleSaveExam(isDraft = false) {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (isDraft) {
      setIsSavingDraft(true);
    } else {
      setIsPublishing(true);
    }

    try {
      const payload = {
        examId: examId || undefined,
        exam: general,
        sections,
        questions,
        isDraft,
      };

      const result = await saveExamAction(payload);

      if (result.error) {
        setErrorMsg(result.error);
        setIsSavingDraft(false);
        setIsPublishing(false);
        return;
      }

      if (result.examId) {
        setExamId(result.examId);
      }

      if (result.sections && result.sections.length > 0) {
        setSections(result.sections);
      }
      if (result.questions) {
        setQuestions(result.questions);
      }

      if (isDraft) {
        setIsDraftMode(true);
        setSuccessMsg(
          "Draft examination successfully saved to the database! You can continue editing or return at any time."
        );
        setIsSavingDraft(false);
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        setSuccessMsg("Examination successfully scheduled, locked, and published!");
        setTimeout(() => {
          router.push("/admin/exams");
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while saving.");
      setIsSavingDraft(false);
      setIsPublishing(false);
    }
  }

  return (
    <div className="space-y-3 pb-12 w-full">
      {/* 1. Sleek Minimal Header Row */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1 pt-0.5">
        <div className="flex items-center space-x-2">
          <Link
            href="/admin/exams"
            className="hover:text-blue-700 flex items-center transition-colors text-slate-600 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Examinations
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
            {general.title ? general.title : "New Examination Paper"}
          </span>
          {general.courseCode && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
              {general.courseCode}
            </span>
          )}
          {isDraftMode && (
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
              Draft in Database
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400">
          <span>Authoring Studio</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>

      {/* 2. Notifications */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-semibold flex items-center space-x-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center space-x-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 3. Studio Tab Bar with Integrated Action Controls */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2 sm:px-3 sm:py-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Wizard Tabs */}
        <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 space-x-1 overflow-x-auto">
          {tabsList.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
                  isActive
                    ? "bg-white text-blue-700 shadow-2xs border border-slate-200/90 ring-1 ring-blue-500/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-colors ${
                    isActive
                      ? "bg-blue-700 text-white shadow-2xs"
                      : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {tab.step}
                </div>
                <span>{tab.shortLabel}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-slate-200/70 text-slate-600"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Studio Action Buttons (Cancel, Save Draft, Publish) */}
        <div className="flex items-center space-x-2 self-start md:self-center flex-shrink-0 pr-0.5">
          <Link
            href="/admin/exams"
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={() => handleSaveExam(true)}
            disabled={isSavingDraft || isPublishing || isLoadingContext}
            title="Save current configuration to the database as a draft"
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSavingDraft ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-slate-500" />
                Saving Draft...
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Save Draft
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSaveExam(false)}
            disabled={isSavingDraft || isPublishing || isLoadingContext}
            className="inline-flex items-center px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Publish &amp; Save Exam
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Active Tab Workspace */}
      <div className="transition-all duration-150">
        {activeTab === "GENERAL" && (
          <GeneralSetupTab
            general={general}
            onChange={(updated) => setGeneral((prev) => ({ ...prev, ...updated }))}
          />
        )}

        {activeTab === "SECTIONS" && (
          <SectionsTab
            sections={sections}
            departments={departments}
            enableNegativeMarking={general.enableNegativeMarking}
            onSectionsChange={setSections}
          />
        )}

        {activeTab === "QUESTIONS" && (
          <QuestionBuilderTab
            sections={sections}
            questions={questions}
            questionBank={questionBank}
            departments={departments}
            enableNegativeMarking={general.enableNegativeMarking}
            onQuestionsChange={setQuestions}
          />
        )}

        {activeTab === "TOOLS" && (
          <CandidateToolsTab
            general={general}
            onChange={(updated) => setGeneral((prev) => ({ ...prev, ...updated }))}
          />
        )}

        {activeTab === "SECURITY" && (
          <SecurityLockdownTab
            general={general}
            onChange={(updated) => setGeneral((prev) => ({ ...prev, ...updated }))}
          />
        )}
      </div>

      {/* 5. Step Navigator Footer Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-3.5 shadow-xs flex items-center justify-between gap-3">
        <div>
          {prevTab ? (
            <button
              type="button"
              onClick={() => setActiveTab(prevTab.id)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back: {prevTab.shortLabel}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-medium pl-1">First step</span>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          Step <strong className="text-slate-800 font-bold">{currentTabIndex + 1}</strong> of{" "}
          <strong className="text-slate-800 font-bold">{tabsList.length}</strong>
        </div>

        <div>
          {nextTab ? (
            <button
              type="button"
              onClick={() => setActiveTab(nextTab.id)}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <span>Next: {nextTab.shortLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleSaveExam(true)}
                disabled={isSavingDraft || isPublishing}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Bookmark className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveExam(false)}
                disabled={isSavingDraft || isPublishing}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                <span>Finish &amp; Publish Exam</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
